# Curated News has heavily modified the original Statsig shell script with a more robust reachability check, including check responses by headers and verifying them by date.
commit=false
origin=$(git remote get-url origin)
if [[ $origin == *CuratedNews/statuses* ]]
then
  commit=true
fi

active_reports=""
KEYSARRAY=()
URLSARRAY=()

urlsConfig="./urls.cfg"
echo "Reading $urlsConfig"
while read -r line
do
  echo "  $line"
  IFS='=' read -ra TOKENS <<< "$line"
  KEYSARRAY+=(${TOKENS[0]})
  URLSARRAY+=(${TOKENS[1]})
done < "$urlsConfig"

echo "***********************"
echo "Starting health checks with ${#KEYSARRAY[@]} configs:"

mkdir -p logs

for (( index=0; index < ${#KEYSARRAY[@]}; index++))
do
  key="${KEYSARRAY[index]}"
  url="${URLSARRAY[index]}"
  echo "  $key=$url"

  for i in 1 2 3 4; 
  do
    report_date=""
    report_title=""
    report_summary=""
    report_mitigated=""
    response=$(curl --write-out '%{http_code}' --silent --output /dev/null $url)
    reponseTime=$(curl --write-out '%{time_total}' --silent --output /dev/null $url)
    linkdomain=$(echo "$url" | sed -e 's|^[^/]*//||' -e 's|/.*$||')
    googlednsresponse=$(curl -s -H 'Accept: application/dns-json' 'https://dns.google/resolve?name='$linkdomain)
    cloudflarednsresponse=$(curl -s -H 'Accept: application/dns-json' 'https://cloudflare-dns.com/dns-query?name='$linkdomain'&type=AAAA')
    googlednsstatus=$(echo "$googlednsresponse" | jq '.Status')
    googlednsstatusreponse=$(echo "$googlednsresponse" | jq '.Answer[] | .data')
    cloudflarednsstatus=$(echo "$cloudflarednsresponse" | jq '.Status')
    cloudflarednsstatusreponse=$(echo "$cloudflarednsresponse" | jq '.Authority[] | .data')
    if [ $linkdomain = "curatednews.xyz" ]; then
      jq -n '{"curatednews.xyz": "'$responseTime'"}' > speed/speed.json
    else
      jq '. |= (. + input)' speed/speed.json <(echo '{"'${linkdomain}'": "'$responseTime'"}') >> tmp.json && mv tmp.json speed/speed.json
    fi
    if [ "$response" -eq 200 ] || [ "$response" -eq 202 ] || [ "$response" -eq 301 ] || [ "$response" -eq 302 ] || [ "$response" -eq 307 ]; then
      result="success"
      if [ $linkdomain = "curatednews.xyz" ]; then
        jq -n '{"curatednews.xyz": "Normal"}' > configuration/configuration.json
      else
        jq '. |= (. + input)' configuration/configuration.json <(echo '{"'${linkdomain}'": "Normal"}') >> tmp.json && mv tmp.json configuration/configuration.json
      fi
    else
      response=$(curl -I --write-out '%header{date}' --silent --output /dev/null $url)
      echo "date of security header request is $response"
      if [ $(echo "$response" | wc -c) -eq 0 ] || [ -z "$response" ]; then
        echo "! $url headers unreachable"
        result="failed"
      else
        header_date=$(date -d "$response" '+%Y-%m-%d')
        echo "converted date of security header request is $header_date"
        date=$(date '+%Y-%m-%d')
        echo "current date is $date"
        todate=$(date -d "$header_date" +%s)
        cond=$(date -d "$date" +%s)
        if [ $todate -ge $cond ]; then
          result="success"
          echo "+ $url headers reachable with correct date-time group"
          if [ $linkdomain = "curatednews.xyz" ]; then
            jq -n '{"curatednews.xyz": "Extra Security"}' > configuration/configuration.json
          else
            jq '. |= (. + input)' configuration/configuration.json <(echo '{"'${linkdomain}'": "Extra Security"}') >> tmp.json && mv tmp.json configuration/configuration.json
          fi
          report_title="Enhanced Security Active"
          report_summary="Our automated system could not get an http response but got timely headers successfully. $linkdomain is either misconfigured or has active protections enabled for extra security. If you are having trouble accessing $linkdomain, please make sure your browser is up-to-date, you do not have interfering browser extensions, cached data, or incorrect user-agent settings. This can indicate unusual browser behavior which may cause a page failure due to flagged security parameters."
          report_mitigated="Security may be permanently enabled."
        else
          result="failed"
          echo "! $url headers unreachable at correct date-time group"
        fi
      fi
      unset response
    fi
    if [ "$result" = "success" ]; then
      echo "response at $url succeeded"
      if [[ $googlednsstatus -eq 0 ]] || [[ $cloudflarednsstatus -eq 0 ]]; then
        echo "$url DNS is working"
        if [ $linkdomain = "curatednews.xyz" ]; then
          jq -n '{"curatednews.xyz": "up"}' > dns/dns.json
        else
          jq '. |= (. + input)' dns/dns.json <(echo '{"'${linkdomain}'": "up"}') >> tmp.json && mv tmp.json dns/dns.json
        fi
      elif [[ $googlednsstatus -eq 1 ]] || [[ $cloudflarednsstatus -eq 1 ]]; then
        echo "$url DNS query incorrect"
      elif [[ $googlednsstatus -eq 2 ]] || [[ $cloudflarednsstatus -eq 2 ]]; then
        echo "$url DNS is down"
        report_date=$(date +%Y-%m-%d-%H:%M:%S-%Z)
        report_title="DNS Outtage"
        report_summary="After DNS uptime check of $linkdomain, Google reported a DNS response code of $googlednsstatus for this server's A records and Cloudflare reported a DNS reponse code of $cloudflarednsstatus for this server's AAAA records. A status and/or error code of 2 means this web server's DNS is currently down."
        report_mitigated="An automated fix is on-going."
        if [ $linkdomain = "curatednews.xyz" ]; then
          jq -n '{"curatednews.xyz": "down"}' > dns/dns.json
        else
          jq '. |= (. + input)' dns/dns.json <(echo '{"'${linkdomain}'": "down"}') >> tmp.json && mv tmp.json dns/dns.json
        fi
      elif [[ $googlednsstatus -eq 3 ]] || [[ $cloudflarednsstatus -eq 3 ]]; then
        echo "$url DNS does not exist"
      elif [[ $googlednsstatus -eq 4 ]] || [[ $cloudflarednsstatus -eq 4 ]]; then
        echo "$url "
      elif [[ $googlednsstatus -eq 5 ]] || [[ $cloudflarednsstatus -eq 5 ]]; then
        echo "$url DNS refused request"
      elif [[ $googlednsstatus -eq 6 ]] || [[ $cloudflarednsstatus -eq 6 ]]; then
        echo "$url DNS availble but should not exist"
      elif [[ $googlednsstatus -eq 7 ]] || [[ $cloudflarednsstatus -eq 7 ]]; then
        echo "$url DNS RRset should not exist is available"
      elif [[ $googlednsstatus -eq 8 ]] || [[ $cloudflarednsstatus -eq 8 ]]; then
        echo "$url DNS not authoritative"
      elif [[ $googlednsstatus -eq 9 ]] || [[ $cloudflarednsstatus -eq 9 ]]; then
        echo "$url DNS not in zone"
      else
        echo "DNS response from DoH was invalid"
      fi
      if [[ "$googlednsstatusreponse" == *"69.163.140.222"* ]] || [[ "$cloudflarednsstatus" == *"dreamhost.com"* ]] && [[ "$linkdomain" == *"curatednews.xyz"* ]]; then
        echo "$url DNS is expected DNS"
        jq -n '{"curatednews.xyz": "secure"}' > security/security.json
      elif [[ "$googlednsstatusreponse" == *"104.21.48.178"* ]] || [[ "$googlednsstatusreponse" == *"172.67.155.85"* ]]; then
        echo "$url DNS is expected DNS"
        jq '. |= (. + input)' security/security.json <(echo '{"'${linkdomain}'": "secure"}') >> tmp.json && mv tmp.json security/security.json
      else
        echo "$url DNS result is unexpected"
        jq '. |= (. + input)' security/security.json <(echo '{"'${linkdomain}'": "insecure"}') >> tmp.json && mv tmp.json security/security.json
      fi
      active_reports="$report_date-_-$report_title-_-$report_summary-_-$report_mitigated"
      break
    fi
    if [ "$result" = "failed" ]; then
      echo "response at $url failed"
      break
    fi
  done
  dateTime=$(date +'%Y-%m-%d %H:%M')
  if [[ $commit == true ]]
  then
    echo $dateTime, $result >> "logs/${key}_report.log"
    echo "$(tail -2000 logs/${key}_report.log)" > "logs/${key}_report.log"
    if [ $linkdomain = "curatednews.xyz" ]; then
      cp incidents/active.json incidents/inactive.json
        jq -n '{"curatednews.xyz": "'$active_reports'"}' > incidents/active.json
    else
        jq '. |= (. + input)' incidents/active.json <(echo '{"'${linkdomain}'": "'${active_reports}'"}') >> tmp.json && mv tmp.json incidents/active.json
    fi
  else
    echo "|| $dateTime, $result"
  fi
done

if [[ $commit == true ]]
then
  git config --global user.name 'Curated News IT'
  git config --global user.email 'it@curatednews.xyz'
  git add -A --force logs/
  git commit -am '[Automated] Update Uptime Logs'
  git push
fi
