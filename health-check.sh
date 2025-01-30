# Curated News has heavily modified the original Statsig shell script with a more robust reachability check, including check responses by headers and verifying them by date.
commit=false
origin=$(git remote get-url origin)
if [[ $origin == *CuratedNews/statuses* ]]
then
  commit=true
fi

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
    response=$(curl --write-out '%{http_code}' --silent --output /dev/null $url)
    if [ "$response" -eq 200 ] || [ "$response" -eq 202 ] || [ "$response" -eq 301 ] || [ "$response" -eq 302 ] || [ "$response" -eq 307 ]; then
      result="success"
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
        else
          result="failed"
          echo "! $url headers unreachable at correct date-time group"
        fi
      fi
      unset response
    fi
    if [ "$result" = "success" ]; then
      echo "response at $url succeeded"
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
    # By default we keep 2000 last log entries.  Feel free to modify this to meet your needs.
    echo "$(tail -2000 logs/${key}_report.log)" > "logs/${key}_report.log"
  else
    echo "    $dateTime, $result"
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
