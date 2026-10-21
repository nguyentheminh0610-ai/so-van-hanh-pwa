#!/bin/bash
# Mã đơn hàng của sàn -> mã vận đơn thật (qua Sapo).
#
# Vì sao cần: Sổ Kho quét MÃ VẬN ĐƠN (862…/854…/SPXVN…/VTPVN…), còn màn hình
# đơn hàng của sàn thường chỉ cho thấy MÃ ĐƠN HÀNG (TikTok 586…/404…, Shopee
# 26…). Ghi sổ lỗi bằng mã đơn hàng thì mục 5 "Thống kê lỗi" và chỉ số lỗi
# theo nhân viên ở mục 3 không tra ra được ai đóng đơn (9/13 ca lỗi T10/2026
# đã dính đúng lỗi này).
#
# Dùng:  ./order_to_tracking.sh 586437463013230236 [586...]
# In ra: <mã đơn>  <mã vận đơn>  <đã quét bởi ai / chưa quét>

set -u
CRED="$HOME/.config/sapo/credentials.json"
[ -f "$CRED" ] || { echo "Thiếu $CRED"; exit 1; }

# BẪY: trường "store" ĐÃ gồm đuôi .mysapo.net — đừng nối thêm.
STORE=$(python3 -c "import json;print(json.load(open('$CRED'))['store'])")
AUTH=$(python3 -c "
import json,base64
c=json.load(open('$CRED'))
print(base64.b64encode((c['api_key']+':'+c['api_secret']).encode()).decode())")
# BẪY: Cloudflare chặn nếu không giả User-Agent Chrome; urllib bị SSL
# handshake failure trên máy này nên phải dùng curl.
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

SB="https://dyvublxyrldmmnsrfvpz.supabase.co/rest/v1"
KEY="${SUPABASE_ANON_KEY:-}"
if [ -z "$KEY" ]; then
  KEY=$(grep -o 'eyJ[A-Za-z0-9._-]*' "$(dirname "$0")/../../../../init.js" 2>/dev/null | head -1)
fi

for CODE in "$@"; do
  TRACK=$(curl -s --max-time 60 \
      -H "Authorization: Basic $AUTH" -H "User-Agent: $UA" -H "Accept: application/json" \
      "https://$STORE/admin/orders.json?query=$CODE&limit=5" \
    | python3 -c "
import sys,json
try: orders=json.load(sys.stdin).get('orders',[])
except Exception: orders=[]
out=[]
for o in orders:
    for f in o.get('fulfillments') or []:
        t=f.get('tracking_number') or f.get('tracking_code')
        if t: out.append(str(t))
print(','.join(dict.fromkeys(out)))")

  if [ -z "$TRACK" ]; then
    echo "$CODE  ->  KHÔNG TÌM THẤY TRONG SAPO (kiểm tra lại mã)"
    continue
  fi

  WHO=""
  if [ -n "$KEY" ]; then
    for T in ${TRACK//,/ }; do
      W=$(curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
            "$SB/warehouse_outbound_checks?code=eq.$T&select=staff,scan_date" \
          | python3 -c "
import sys,json
r=json.load(sys.stdin)
print(f\"{r[0]['staff']} ({r[0]['scan_date']})\" if r else '')")
      [ -n "$W" ] && WHO="$W" && break
    done
  fi
  echo "$CODE  ->  $TRACK  ->  ${WHO:-kho chưa quét mã này}"
done
