#!/usr/bin/env bash
# progress.sh — самокалибриращ се индикатор + ЖИВ брояч на дъното.
# Показва:
#   • дискретни редове при всяка секция (история, нагоре);
#   • ПОСТОЯНЕН ред най-отдолу (фонов брояч, всяка секунда): колко ОСТАВА глобално и per server,
#     КАКВО се изпълнява сега (четимо име) на КОЯ машина, и кои секции предстоят.
#
# Времената се пазят по (секция#сървър@профил); четимите имена на секциите се учат (NAME.labels).
# API:  progress_start NAME "PLAN" "PROFILE" | progress_context NAME SRV | progress_step NAME LABEL | progress_finish NAME ok
# Изключване на долния ред: KCY_PROGRESS_NOBOTTOM=1
# Еталон: $HOME/.kcy-progress/NAME.{sec,labels,live,cur}

_P_DIR="${HOME:-/tmp}/.kcy-progress"; mkdir -p "$_P_DIR" 2>/dev/null
_P_DEFAULT="${KCY_PROGRESS_DEFAULT:-60}"

# Приятелско име на сървъра/целта (кодовете prodts/vm не се разбират).
_p_srv() { case "$1" in prodts|prod|production) printf 'Production';; vm|VM) printf 'Виртуална машина';; —|""|local) printf 'локално';; *) printf '%s' "$1";; esac; }

progress_start() {
  _P_NAME="$1"; _P_PLAN="${2:-}"; _P_PROFILE="${3:-def}"; _P_T0="$(date +%s)"
  _P_SEC="$_P_DIR/$1.sec"; _P_LIVE="$_P_DIR/$1.live"; _P_CURF="$_P_DIR/$1.cur"; _P_LBLF="$_P_DIR/$1.labels"
  declare -gA _P_TBL=() _P_RUN=() _P_LBL=() _P_RUNLBL=()
  if [ -f "$_P_SEC" ]; then  while IFS=$'\t' read -r k s; do [ -n "$k" ] && _P_TBL["$k"]="$s"; done < "$_P_SEC";  fi
  if [ -f "$_P_LBLF" ]; then while IFS=$'\t' read -r k s; do [ -n "$k" ] && _P_LBL["$k"]="$s"; done < "$_P_LBLF"; fi
  _P_TOTAL=0; _P_NPLAN=0; local tok
  for tok in $_P_PLAN; do _P_TOTAL=$(( _P_TOTAL + ${_P_TBL[${tok}@${_P_PROFILE}]:-$_P_DEFAULT} )); _P_NPLAN=$((_P_NPLAN+1)); done
  [ "$_P_TOTAL" -le 0 ] && _P_TOTAL=1; [ "$_P_NPLAN" -le 0 ] && _P_NPLAN=1
  _P_DONE_EXP=0; _P_PREVKEY=""; _P_PREVSTART=0; _P_I=0; _P_CTX=""
  _P_HAVE=0; [ -s "$_P_SEC" ] && _P_HAVE=1
  # състояние за живия брояч: S idx sec server exp label(четим)
  : > "$_P_LIVE"; local i=0 sec server exp
  for tok in $_P_PLAN; do
    i=$((i+1)); sec="${tok%%#*}"; server="—"; [ "$tok" != "${tok#*#}" ] && server="${tok#*#}"
    exp="${_P_TBL[${tok}@${_P_PROFILE}]:-$_P_DEFAULT}"
    printf 'S\t%d\t%s\t%s\t%d\t%s\n' "$i" "$sec" "$server" "$exp" "${_P_LBL[$sec]:-$sec}" >> "$_P_LIVE"
  done
  printf '0\t%s\n' "$_P_T0" > "$_P_CURF"
  _P_MAIN_PID=$$; _P_TICK_PID=""
  if [ "${KCY_PROGRESS_NOBOTTOM:-0}" != 1 ] && [ -w /dev/tty ]; then
    _p_ticker "$_P_LIVE" "$_P_CURF" "$_P_MAIN_PID" & _P_TICK_PID=$!
  fi
}

progress_context() { _P_CTX="${2:-}"; }

_p_bar() { local pct="$1" w="${2:-26}" i f; f=$(( pct * w / 100 )); [ "$f" -lt 0 ] && f=0; [ "$f" -gt "$w" ] && f=$w
  printf '['; for ((i=0;i<w;i++)); do [ "$i" -lt "$f" ] && printf '■' || printf '·'; done; printf ']'; }
_p_fmt() { local s="$1"; [ "$s" -lt 0 ] && s=0; if [ "$s" -ge 60 ]; then printf '%dм %02dс' $((s/60)) $((s%60)); else printf '%dс' "$s"; fi; }

_p_close_prev() {
  [ -z "$_P_PREVKEY" ] && return
  local now="$1"; local dur=$(( now - _P_PREVSTART )); [ "$dur" -lt 0 ] && dur=0
  _P_RUN["$_P_PREVKEY"]="$dur"; _P_DONE_EXP=$(( _P_DONE_EXP + ${_P_TBL[$_P_PREVKEY]:-$_P_DEFAULT} ))
}

progress_step() {
  local name="$1"; shift; local label="$*"; local sec="${label%% *}"
  local key="${sec}${_P_CTX:+#$_P_CTX}@${_P_PROFILE}"
  local disp="$label"; [ -n "${_P_CTX:-}" ] && disp="$label · $(_p_srv "$_P_CTX")"
  # четим етикет (без кода отпред), за да го знае живият брояч
  local lbl="${label#$sec}"; lbl="${lbl#"${lbl%%[![:space:]]*}"}"; [ -z "$lbl" ] && lbl="$label"
  _P_RUNLBL["$sec"]="$lbl"
  local now=$(( $(date +%s) - _P_T0 ))
  _p_close_prev "$now"; _P_I=$(( _P_I + 1 ))
  local C=$'\e[36m' G=$'\e[32m' X=$'\e[0m'
  local sec_exp="${_P_TBL[$key]:-$_P_DEFAULT}"
  local cnt_pct=$(( (_P_I - 1) * 100 / _P_NPLAN ))
  if [ "${_P_HAVE:-0}" = 1 ]; then
    local remaining=$(( _P_TOTAL - _P_DONE_EXP )); [ "$remaining" -lt 0 ] && remaining=0
    local pct=$(( _P_DONE_EXP * 100 / _P_TOTAL )); [ "$pct" -gt 99 ] && pct=99
    local eta="$remaining"; [ "$_P_DONE_EXP" -gt 0 ] && [ "$now" -gt 0 ] && eta=$(( remaining * now / _P_DONE_EXP ))
    printf '   %sГЛОБАЛНО%s %s %d%% · остават ~%s · общо ~%s\n' "$C" "$X" "$(_p_bar "$pct")" "$pct" "$(_p_fmt "$eta")" "$(_p_fmt "$_P_TOTAL")"
    printf '   %sСекция %d/%d%s %s · %s · тази секция ~%s\n' "$C" "$_P_I" "$_P_NPLAN" "$X" "$(_p_bar "$cnt_pct" 12)" "$disp" "$(_p_fmt "$sec_exp")"
  else
    printf '   %sГЛОБАЛНО%s %s (калибриране, %s изминали)\n' "$C" "$X" "$(_p_bar 0)" "$(_p_fmt "$now")"
    printf '   %sСекция %d/%d%s %s · %s\n' "$C" "$_P_I" "$_P_NPLAN" "$X" "$(_p_bar "$cnt_pct" 12)" "$disp"
  fi
  _P_PREVKEY="$key"; _P_PREVSTART="$now"
  printf '%d\t%s\n' "$_P_I" "$(date +%s)" > "$_P_CURF"
}

progress_finish() {
  local name="$1"; local ok="${2:-}"; local now=$(( $(date +%s) - _P_T0 ))
  _p_close_prev "$now"
  [ -n "${_P_TICK_PID:-}" ] && kill "$_P_TICK_PID" 2>/dev/null
  [ "${KCY_PROGRESS_NOBOTTOM:-0}" != 1 ] && [ -w /dev/tty ] && printf '\e[r' > /dev/tty 2>/dev/null
  local G=$'\e[32m' X=$'\e[0m'
  printf '   %sГЛОБАЛНО%s %s 100%% · готово за %s (еталонът по секции×сървър×профил е обновен)\n' "$G" "$X" "$(_p_bar 100)" "$(_p_fmt "$now")"
  if [ "$ok" = "ok" ]; then
    local k
    for k in "${!_P_RUN[@]}"; do _P_TBL["$k"]="${_P_RUN[$k]}"; done
    : > "$_P_SEC"; for k in "${!_P_TBL[@]}"; do printf '%s\t%s\n' "$k" "${_P_TBL[$k]}" >> "$_P_SEC"; done
    for k in "${!_P_RUNLBL[@]}"; do _P_LBL["$k"]="${_P_RUNLBL[$k]}"; done
    : > "$_P_LBLF"; for k in "${!_P_LBL[@]}"; do printf '%s\t%s\n' "$k" "${_P_LBL[$k]}" >> "$_P_LBLF"; done
  fi
}

# ── ЖИВИЯТ БРОЯЧ ────────────────────────────────────────────────────────────────
_p_frame() {  # $1=live $2=cur $3=now → 2 реда: глобално + per server + СЕГА (четимо) + предстоящи
  local live="$1" curf="$2" now="$3"
  local curidx curstart; { IFS=$'\t' read -r curidx curstart; } < "$curf" 2>/dev/null
  curidx="${curidx:-0}"; curstart="${curstart:-$now}"
  local totrem=0 tot=0 order="" tag idx sec server exp label rem cs="" cserver="" cexp=0
  declare -A srvrem=() pend=()
  while IFS=$'\t' read -r tag idx sec server exp label; do
    [ "$tag" = "S" ] || continue; [ -z "$label" ] && label="$sec"; tot=$(( tot + exp ))
    if   [ "$idx" -lt "$curidx" ]; then rem=0
    elif [ "$idx" -eq "$curidx" ]; then rem=$(( exp-(now-curstart) )); [ "$rem" -lt 0 ] && rem=0; cs="$label"; cserver="$server"; cexp="$exp"
    else rem="$exp"; fi
    totrem=$((totrem+rem)); srvrem["$server"]=$(( ${srvrem["$server"]:-0}+rem ))
    if [ "$idx" -ge "$curidx" ] && [ "$idx" -gt 0 ]; then
      case " $order " in *" $server "*) : ;; *) order="$order $server";; esac
      pend["$server"]="${pend["$server"]}, ${label}"
    fi
  done < "$live"
  [ "$tot" -le 0 ] && tot=1; local dn=$(( tot - totrem )); [ "$dn" -lt 0 ] && dn=0
  local pct=$(( dn * 100 / tot )); [ "$pct" -gt 99 ] && pct=99; [ "$pct" -lt 0 ] && pct=0
  local g="⏱ ГЛОБАЛНО $(_p_bar "$pct") ${pct}% · остават ~$(_p_fmt "$totrem") · общо ~$(_p_fmt "$tot")"
  local line1="  " s
  for s in $order; do line1="$line1 $(_p_srv "$s") ~$(_p_fmt "${srvrem[$s]:-0}") ·"; done
  if [ -n "$cs" ]; then local cr=$(( cexp-(now-curstart) )); [ "$cr" -lt 0 ] && cr=0; line1="$line1 СЕГА: ${cs} на $(_p_srv "$cserver") ~$(_p_fmt "$cr")"; fi
  local line2="   Предстои —"; for s in $order; do line2="$line2  $(_p_srv "$s"): ${pend[$s]#, } ·"; done
  printf '%s\n%s\n%s\n' "$g" "${line1% ·}" "${line2% ·}"
}

_p_ticker() {
  local live="$1" curf="$2" mainpid="$3" rows cols L1 L2 now
  rows=$(tput lines 2>/dev/null || echo 40); [ "$rows" -lt 10 ] && rows=40
  cols=$(tput cols 2>/dev/null || echo 120); [ "$cols" -lt 20 ] && cols=120
  { printf '\e[1;%dr' $((rows-3)); printf '\e[%d;1H' $((rows-3)); } > /dev/tty 2>/dev/null
  while kill -0 "$mainpid" 2>/dev/null; do
    now=$(date +%s)
    { IFS= read -r L1; IFS= read -r L2; IFS= read -r L3; } < <(_p_frame "$live" "$curf" "$now")
    L1="${L1:0:cols}"; L2="${L2:0:cols}"; L3="${L3:0:cols}"
    printf '\e7\e[%d;1H\e[2K\e[1;36m%s\e[0m\e[%d;1H\e[2K\e[36m%s\e[0m\e[%d;1H\e[2K\e[90m%s\e[0m\e8' $((rows-2)) "$L1" $((rows-1)) "$L2" "$rows" "$L3" > /dev/tty 2>/dev/null
    sleep 1
  done
  printf '\e[r' > /dev/tty 2>/dev/null
}
