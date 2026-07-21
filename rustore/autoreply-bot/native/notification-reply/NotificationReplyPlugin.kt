package com.pupikes.notificationreply

import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * NotificationReplyPlugin — Capacitor мост към KcyNotificationListener.
 *
 * Методи, видими в JS (registerPlugin('NotificationReply')):
 *   isAccessGranted()  -> { value: Boolean }   — дали е даден „Notification access".
 *   openAccessSettings() -> {}                 — отваря системния екран за достъпа.
 *   getRecent()        -> { messages: [...] }  — последните заловени съобщения.
 *   reply({key, text}) -> { ok: Boolean }      — direct-reply по дадена нотификация.
 *
 * Event:
 *   notify('message', {...}) при всяко ново заловено съобщение (JS се абонира с addListener).
 */
@CapacitorPlugin(name = "NotificationReply")
class NotificationReplyPlugin : Plugin() {

    override fun load() {
        // Закачаме се за потока от нови съобщения и ги препращаме към JS като event.
        KcyNotificationListener.onMessage = { msg ->
            try {
                notifyListeners("message", JSObject.fromJSONObject(msg.toJson()))
            } catch (_: Exception) {
            }
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        KcyNotificationListener.onMessage = null
    }

    /** Дали нашият пакет е сред enabled notification listeners. */
    @PluginMethod
    fun isAccessGranted(call: PluginCall) {
        val granted = NotificationManagerCompat
            .getEnabledListenerPackages(context)
            .contains(context.packageName)
        call.resolve(JSObject().put("value", granted))
    }

    /** Отваря системния екран „Notification access". */
    @PluginMethod
    fun openAccessSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Неуспех при отваряне на настройките за Notification access", e)
        }
    }

    /** Връща буфера от последните заловени съобщения. */
    @PluginMethod
    fun getRecent(call: PluginCall) {
        val res = JSObject()
        res.put("messages", KcyNotificationListener.recentAsJson())
        res.put("connected", KcyNotificationListener.connected)
        call.resolve(res)
    }

    /** Изпраща direct-reply по нотификацията с подадения ключ. */
    @PluginMethod
    fun reply(call: PluginCall) {
        val key = call.getString("key")
        val text = call.getString("text")
        if (key.isNullOrEmpty() || text.isNullOrEmpty()) {
            call.reject("Изискват се 'key' и 'text'.")
            return
        }
        val ok = KcyNotificationListener.replyTo(context, key, text)
        if (ok) {
            call.resolve(JSObject().put("ok", true))
        } else {
            call.reject("Direct-reply неуспешен: нотификацията липсва или няма RemoteInput.")
        }
    }
}
