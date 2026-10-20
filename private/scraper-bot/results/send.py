# send.py — изпраща писмото до имейлите от ОПАШКА-ФАЙЛ. СТАРТИРА СЕ ОТ ТАЗИ ПАПКА (results/).
#
# Модел: четем САМО от  results/sending.to.txt  (имейли, разделени със запетая ИЛИ нов ред).
#   • Няма такъв файл → създаваме го ПРАЗЕН и спираме (ти слагаш имейлите вътре).
#   • Всеки УСПЕШНО изпратен имейл се ТРИЕ веднага от файла → при спиране на тока/прекъсване
#     файлът съдържа точно оставащите (без дублиране при повторно пускане).
#
# Преглед (НИЩО не праща):     python send.py
# Реално изпращане:            python send.py --send
# Друго писмо/подател:         python send.py --letter familienrecht --reply-to x@y.z --send
#
# Подател: от private/scraper-bot/.env (scraper_email_user + app-парола, scraper_sender_name).
# Пауза мин 5 мин/писмо + джитър; дневен лимит max_per_run (виж .env/mailer.py).
import os, sys, csv, re, argparse
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stdin.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
BOT = os.path.dirname(HERE)                 # private/scraper-bot
sys.path.insert(0, BOT)
import mailer, config                        # noqa: E402

LETTERS = os.path.join(BOT, "letters")
QUEUE = os.path.join(HERE, "sending.to.txt")
PLACEHOLDERS = ("[BITTE AUSFÜLLEN", "[РЕДАКТИРАЙ", "[KURZ:", "[ПОПЪЛНИ")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")


def load_letter(topic):
    def rd(suffix):
        p = os.path.join(LETTERS, topic + suffix)
        if not os.path.exists(p):
            sys.exit("Липсва писмо: " + p)
        with open(p, encoding="utf-8") as f:
            return f.read()
    return rd(".subject.txt").strip(), rd(".de.txt")


def read_queue():
    """Връща списък имейли от sending.to.txt (запетая/нов ред/интервал/точка-запетая),
       дедуп със запазен ред. Ако файлът липсва → създава го празен и спира."""
    if not os.path.exists(QUEUE):
        open(QUEUE, "w", encoding="utf-8").close()
        sys.exit("Създадох ПРАЗЕН файл:\n   " + QUEUE +
                 "\nСложи вътре имейлите (разделени със запетая или на нов ред) и пусни пак.")
    with open(QUEUE, encoding="utf-8-sig") as f:
        raw = f.read()
    out, seen = [], set()
    for m in EMAIL_RE.findall(raw):
        e = m.strip().strip(".,;:").lower()
        if e and e not in seen:
            seen.add(e); out.append(e)
    return out


def remove_from_queue(email):
    """Маха ЕДИН имейл от sending.to.txt и презаписва ВЕДНАГА (устойчиво на прекъсване).
       Чете файла наново всеки път (за да уважи и ръчни промени), пише по един на ред."""
    try:
        rest = [e for e in read_queue_silent() if e != email.lower()]
        tmp = QUEUE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write("\n".join(rest) + ("\n" if rest else ""))
        os.replace(tmp, QUEUE)   # атомарна подмяна
    except Exception as e:
        print("   ⚠ не можах да обновя опашката:", e, flush=True)


def read_queue_silent():
    if not os.path.exists(QUEUE):
        return []
    with open(QUEUE, encoding="utf-8-sig") as f:
        raw = f.read()
    out, seen = [], set()
    for m in EMAIL_RE.findall(raw):
        e = m.strip().strip(".,;:").lower()
        if e and e not in seen:
            seen.add(e); out.append(e)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--letter", default="familienrecht")
    ap.add_argument("--reply-to", default="kalaydzhievvaleri@gmail.com",
                    help="адрес за отговори (Reply-To); празно = без")
    ap.add_argument("--send", action="store_true", help="РЕАЛНО изпращане (иначе само преглед)")
    ap.add_argument("--yes", action="store_true", help="пропусни въпроса за потвърждение")
    a = ap.parse_args()

    subject, body = load_letter(a.letter)
    name = config.get("scraper_sender_name", "").strip()
    frm = config.SMTP.get("user", "")
    body = body.replace("{SENDER_NAME}", name or "[НЯМА ИМЕ]").replace("{SENDER_EMAIL}", frm)
    emails = read_queue()               # създава празен + спира, ако липсва
    try:
        max_run = int(config.SMTP.get("max_per_run", 120))
    except Exception:
        max_run = 120

    bad = [ph for ph in PLACEHOLDERS if ph in subject or ph in body]
    print("=" * 64)
    print("ПОДАТЕЛ:   %s  (%s)" % (frm or "[няма — задай .env]", name or "[няма име]"))
    print("REPLY-TO:  %s" % (a.reply_to or "[няма]"))
    print("ПИСМО:     letters/%s.de.txt  |  ТЕМА: %s" % (a.letter, subject))
    print("ОПАШКА:    %s  →  %d имейла чакат" % (os.path.basename(QUEUE), len(emails)))
    print("ПАУЗА:     мин 5 мин/писмо + джитър  |  дневен лимит: %d" % max_run)
    print("=" * 64)
    if bad:
        print("\n⛔ ПИСМОТО Е ОЩЕ ШАБЛОН — попълни/махни тези полета преди да пратиш:")
        for ph in bad:
            print("   ", ph + "…")
        sys.exit(1)
    if not emails:
        sys.exit("\nℹ Опашката е ПРАЗНА. Сложи имейли в %s и пусни пак." % os.path.basename(QUEUE))

    print("\n--- ПРЕГЛЕД НА ПИСМОТО ---\n")
    print(subject); print(); print(body)
    print("\n--- първи 5 от опашката ---")
    for e in emails[:5]:
        print("   ", e)

    if not a.send:
        print("\nℹ Само ПРЕГЛЕД. За реално изпращане добави  --send")
        return
    if not frm or not config.SMTP.get("password"):
        sys.exit("⛔ Няма подател/парола в .env (scraper_email_user + app-парола).")
    if not a.yes:
        c = input("\nНаистина да изпратя до %d адреса (до %d този път) от %s? Напиши ДА: "
                  % (len(emails), min(max_run, len(emails)), frm))
        if c.strip() != "ДА":
            sys.exit("Отказано.")

    import time, random
    sent_ok = 0
    failed = set()        # провалили се ТОЗИ пробег → остават във файла, пробват се следващия път
    delay_s = max(5, int(config.SMTP.get("delay_minutes", 5))) * 60
    while sent_ok < max_run:
        q = read_queue_silent()                      # файлът = единственият източник; чете се НАНОВО всеки път
        email = next((e for e in q if e not in failed), None)
        if email is None:
            break                                    # нищо повече за пращане този пробег
        res = mailer.send_bulk([email], subject, body, from_name=name or None,
                               reply_to=(a.reply_to or None), delay=False)
        if res.get("sent"):                          # ПОТВЪРДЕНО прието от SMTP → чак сега трия
            remove_from_queue(email)
            sent_ok += 1
            print("   ✓ %s   (остават %d)" % (email, len(read_queue_silent())), flush=True)
            if sent_ok < max_run and any(e not in failed for e in read_queue_silent()):
                time.sleep(delay_s + random.randint(0, 90))   # пауза само ако има още за пращане
        elif res.get("errors"):                      # НЕуспех → НЕ трия; остава на мястото си за следващ път
            failed.add(email)
            print("   ✗ %s — грешка, ОСТАВЯМ го в опашката: %s" % (email, res["errors"][:1]), flush=True)
        else:                                         # вече пратен по-рано (sent_log) / изключен → махни
            remove_from_queue(email)
            print("   ↷ %s — вече пратен/изключен, махнат от опашката" % email, flush=True)
    rem = len(read_queue_silent())
    print("\nГОТОВО за този пробег | изпратени: %d | неуспели (остават): %d | общо в опашката: %d"
          % (sent_ok, len(failed), rem))
    if failed:
        print("ℹ Неуспелите остават в %s и ще се пробват при следващото пускане." % os.path.basename(QUEUE))


if __name__ == "__main__":
    main()
