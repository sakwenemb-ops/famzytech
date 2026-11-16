#!/bin/sh
# Background jobs, in a loop (no cron needed):
#   every 5 min: money (payments, lessons, earnings, withdrawals) and library (AI corrections)
#   every 10 min: bookings (release unpaid holds, reminders)
#   once a day: delete expired files
i=0
while true; do
  npm run -s jobs:money || echo "jobs:money failed"
  npm run -s jobs:library || echo "jobs:library failed"
  if [ $((i % 2)) -eq 0 ]; then npm run -s jobs:bookings || echo "jobs:bookings failed"; fi
  if [ $((i % 288)) -eq 0 ]; then npm run -s jobs:purge-files || echo "jobs:purge-files failed"; fi
  i=$((i + 1))
  sleep 300
done
