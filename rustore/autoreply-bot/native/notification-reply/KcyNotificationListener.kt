package com.pupikes.notificationreply

import android.app.Notification
import android.app.RemoteInput
import android.content.Intent
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * KcyNotificationListener
 *
 * Реален NotificationListenerService. Чете нотификациите на целевите месинджъри
 * (WhatsApp / Viber / Facebook Messenger), извлича подател + текст, буферира последните
 * и може да изпрати DIRECT-REPLY чрез RemoteInput на самата нотификация — без да отваря
 * приложението.
 *
 * Това е ЕДИНСТВЕНИЯТ безплатен on-device начин за авто-отговор в тези приложения на Android.
 * Изисква потребителят да даде „Notification access" в системните настройки.
 *
 * Буферът и активните нотификации са static, за да може Capacitor плъгинът
 * (NotificationReplyPlugin) да ги чете/ползва, без да държи референция към инстанцията на услугата.
 */
class KcyNotificationListener : NotificationListenerService() {

    companion object {
        /** Целеви package имена. */
        val TARGET_PACKAGES = setOf(
            "com.whatsapp",        // WhatsApp
            "com.viber.voip",      // Viber
            "com.facebook.orca"    // Facebook Messenger
        )

        private const val MAX_BUFFER = 50

        /** Дали услугата е свързана (системата я е стартирала след даден достъп). */
        @Volatile
        var connected: Boolean = false
            internal set

        /** Заловени съобщения (последните MAX_BUFFER), най-новото отзад. */
        private val recent = ArrayList<CapturedMessage>()

        /** Активни нотификации по ключ — за да можем да изстреляме direct-reply по-късно. */
        private val active = HashMap<String, StatusBarNotification>()

        /** Слушател за нови съобщения (плъгинът се закача тук, за да emit-ва event към JS). */
        @Volatile
        var onMessage: ((CapturedMessage) -> Unit)? = null

        @Synchronized
        fun recentAsJson(): JSONArray {
            val arr = JSONArray()
            for (m in recent) arr.put(m.toJson())
            return arr
        }

        @Synchronized
        private fun addRecent(m: CapturedMessage) {
            recent.add(m)
            while (recent.size > MAX_BUFFER) recent.removeAt(0)
        }

        @Synchronized
        fun activeFor(key: String): StatusBarNotification? = active[key]

        @Synchronized
        fun putActive(key: String, sbn: StatusBarNotification) {
            active[key] = sbn
        }

        @Synchronized
        fun removeActive(key: String) {
            active.remove(key)
        }

        /** Намира първия Notification.Action, който носи RemoteInput (т.е. „Reply"). */
        fun findReplyAction(n: Notification?): Notification.Action? {
            val actions = n?.actions ?: return null
            for (a in actions) {
                val inputs = a.remoteInputs
                if (inputs != null && inputs.isNotEmpty()) return a
            }
            return null
        }

        /**
         * Изпраща direct-reply по нотификация с даден ключ — статично, за да го вика
         * Capacitor плъгинът с неговия Context (услугата може и да не е жива инстанция).
         * @return true ако е изпратено успешно.
         */
        fun replyTo(context: android.content.Context, key: String, text: String): Boolean {
            val sbn = activeFor(key) ?: return false
            val n = sbn.notification ?: return false
            val action = findReplyAction(n) ?: return false
            val remoteInput = action.remoteInputs?.firstOrNull() ?: return false

            val intent = Intent()
            val results = Bundle().apply { putCharSequence(remoteInput.resultKey, text) }
            RemoteInput.addResultsToIntent(arrayOf(remoteInput), intent, results)

            return try {
                action.actionIntent.send(context, 0, intent)
                true
            } catch (_: Exception) {
                false
            }
        }
    }

    /** Един заловен ред: ключ на нотификацията, package, подател, текст, време. */
    data class CapturedMessage(
        val key: String,
        val pkg: String,
        val sender: String,
        val text: String,
        val postedAt: Long,
        val canReply: Boolean
    ) {
        fun toJson(): JSONObject = JSONObject()
            .put("key", key)
            .put("pkg", pkg)
            .put("sender", sender)
            .put("text", text)
            .put("postedAt", postedAt)
            .put("canReply", canReply)
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        connected = true
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        connected = false
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val pkg = sbn.packageName ?: return
        if (pkg !in TARGET_PACKAGES) return

        val n = sbn.notification ?: return
        val extras: Bundle = n.extras ?: return

        // Подател = EXTRA_TITLE (обикновено името на чата/контакта).
        val sender = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        // Текст = EXTRA_TEXT (последното съобщение). Пропускаме „служебните" нотификации без текст.
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
        if (text.isEmpty()) return

        // Пазим референция към нотификацията, за да можем после да отговорим по нея.
        putActive(sbn.key, sbn)

        val canReply = KcyNotificationListener.findReplyAction(n) != null

        val msg = CapturedMessage(
            key = sbn.key,
            pkg = pkg,
            sender = if (sender.isNotEmpty()) sender else "(непознат)",
            text = text,
            postedAt = sbn.postTime,
            canReply = canReply
        )
        addRecent(msg)

        try {
            onMessage?.invoke(msg)
        } catch (_: Exception) {
            // Не позволяваме грешка от JS моста да събори услугата.
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        removeActive(sbn.key)
    }
}
