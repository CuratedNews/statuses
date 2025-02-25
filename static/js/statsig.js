const maxDays = 30;

async function genReportLog(container, key, url) {
  const response = await fetch("logs/" + key + "_report.log");
  let statusLines = "";
  if (response.ok) {
    statusLines = await response.text();
  }

  const normalized = normalizeData(statusLines);
  const statusStream = constructStatusStream(key, url, normalized);
  container.appendChild(statusStream);
}

function constructStatusStream(key, url, uptimeData) {
  let streamContainer = templatize("statusStreamContainerTemplate");
  for (var ii = maxDays - 1; ii >= 0; ii--) {
    let line = constructStatusLine(key, ii, uptimeData[ii]);
    streamContainer.appendChild(line);
  }

  const lastSet = uptimeData[0];
  const color = getColor(lastSet);

  const container = templatize("statusContainerTemplate", {
    title: key,
    url: url,
    color: color,
    status: getStatusText(color),
    upTime: uptimeData.upTime,
  });

  container.appendChild(streamContainer);
  return container;
}

function constructStatusLine(key, relDay, upTimeArray) {
  let date = new Date();
  date.setDate(date.getDate() - relDay);

  return constructStatusSquare(key, date, upTimeArray);
}

function getColor(uptimeVal) {
  return uptimeVal == null
    ? "nodata"
    : uptimeVal == 1
    ? "success"
    : uptimeVal < 0.3
    ? "failure"
    : "partial";
}

function constructStatusSquare(key, date, uptimeVal) {
  const color = getColor(uptimeVal);
  let square = templatize("statusSquareTemplate", {
    color: color,
    tooltip: getTooltip(key, date, color),
  });

  const show = () => {
    showTooltip(square, key, date, color);
  };
  square.addEventListener("mouseover", show);
  square.addEventListener("mousedown", show);
  square.addEventListener("mouseout", hideTooltip);
  return square;
}

let cloneId = 0;
function templatize(templateId, parameters) {
  let clone = document.getElementById(templateId).cloneNode(true);
  clone.id = "template_clone_" + cloneId++;
  if (!parameters) {
    return clone;
  }

  applyTemplateSubstitutions(clone, parameters);
  return clone;
}

function applyTemplateSubstitutions(node, parameters) {
  const attributes = node.getAttributeNames();
  for (var ii = 0; ii < attributes.length; ii++) {
    const attr = attributes[ii];
    const attrVal = node.getAttribute(attr);
    node.setAttribute(attr, templatizeString(attrVal, parameters));
  }

  if (node.childElementCount == 0) {
    node.innerText = templatizeString(node.innerText, parameters);
  } else {
    const children = Array.from(node.children);
    children.forEach((n) => {
      applyTemplateSubstitutions(n, parameters);
    });
  }
}

function templatizeString(text, parameters) {
  if (parameters) {
    for (const [key, val] of Object.entries(parameters)) {
      text = text.replaceAll("$" + key, val);
    }
  }
  return text;
}

function getStatusText(color) {
  return color == "nodata"
    ? "No Data Available"
    : color == "success"
    ? "Fully Operational"
    : color == "failure"
    ? "Major Outage"
    : color == "partial"
    ? "Partial Outage"
    : "Unknown";
}

function getStatusDescriptiveText(color) {
  return color == "nodata"
    ? "No Data Available: Health check was not performed."
    : color == "success"
    ? "No downtime recorded on this day."
    : color == "failure"
    ? "Major outages recorded on this day."
    : color == "partial"
    ? "Partial outages recorded on this day."
    : "Unknown";
}

function getTooltip(key, date, quartile, color) {
  let statusText = getStatusText(color);
  return `${key} | ${date.toDateString()} : ${quartile} : ${statusText}`;
}

function create(tag, className) {
  let element = document.createElement(tag);
  element.className = className;
  return element;
}

function normalizeData(statusLines) {
  const rows = statusLines.split("\n");
  const dateNormalized = splitRowsByDate(rows);

  let relativeDateMap = {};
  const now = Date.now();
  for (const [key, val] of Object.entries(dateNormalized)) {
    if (key == "upTime") {
      continue;
    }

    const relDays = getRelativeDays(now, new Date(key).getTime());
    relativeDateMap[relDays] = getDayAverage(val);
  }

  relativeDateMap.upTime = dateNormalized.upTime;
  return relativeDateMap;
}

function getDayAverage(val) {
  if (!val || val.length == 0) {
    return null;
  } else {
    return val.reduce((a, v) => a + v) / val.length;
  }
}

function getRelativeDays(date1, date2) {
  return Math.floor(Math.abs((date1 - date2) / (24 * 3600 * 1000)));
}

function splitRowsByDate(rows) {
  let dateValues = {};
  let sum = 0,
    count = 0;
  for (var ii = 0; ii < rows.length; ii++) {
    const row = rows[ii];
    if (!row) {
      continue;
    }

    const [dateTimeStr, resultStr] = row.split(",", 2);
    const dateTime = new Date(Date.parse(dateTimeStr.replace(/-/g, "/") + " GMT"));
    const dateStr = dateTime.toDateString();

    let resultArray = dateValues[dateStr];
    if (!resultArray) {
      resultArray = [];
      dateValues[dateStr] = resultArray;
      if (dateValues.length > maxDays) {
        break;
      }
    }

    let result = 0;
    if (resultStr.trim() == "success") {
      result = 1;
    }
    sum += result;
    count++;

    resultArray.push(result);
  }

  const upTime = count ? ((sum / count) * 100).toFixed(2) + "%" : "--%";
  dateValues.upTime = upTime;
  return dateValues;
}

let tooltipTimeout = null;
function showTooltip(element, key, date, color) {
  clearTimeout(tooltipTimeout);
  const toolTipDiv = document.getElementById("tooltip");

  document.getElementById("tooltipDateTime").innerText = date.toDateString();
  document.getElementById("tooltipDescription").innerText =
    getStatusDescriptiveText(color);

  const statusDiv = document.getElementById("tooltipStatus");
  statusDiv.innerText = getStatusText(color);
  statusDiv.className = color;

  toolTipDiv.style.top = element.offsetTop + element.offsetHeight + 10;
  toolTipDiv.style.left =
    element.offsetLeft + element.offsetWidth / 2 - toolTipDiv.offsetWidth / 2;
  toolTipDiv.style.opacity = "1";
}

function hideTooltip() {
  tooltipTimeout = setTimeout(() => {
    const toolTipDiv = document.getElementById("tooltip");
    toolTipDiv.style.opacity = "0";
  }, 1000);
}

async function genAllReports() {
  const response = await fetch("urls.cfg");
  const configText = await response.text();
  const configLines = configText.split("\n");
  for (let ii = 0; ii < configLines.length; ii++) {
    const configLine = configLines[ii];
    const [key, url] = configLine.split("=");
    if (!key || !url) {
      continue;
    }

    await genReportLog(document.getElementById("reports"), key, url);
  }
}

async function genIncidentReport() {
  const response = await fetch(
    "incidents/template.json"
  );
  if (response.ok) {
    const json = await response.json();
    try {
      const activeDom = DOMPurify.sanitize(
        marked.parse(json.active ? json.active : "No active incidents")
      );
      const inactiveDom = DOMPurify.sanitize(marked.parse(json.inactive));
      document.getElementById("activeIncidentReports").innerHTML = activeDom;
      document.getElementById("pastIncidentReports").innerHTML = inactiveDom;

      if (json.active) {
        setTimeout(() => {
          document.getElementById("incidents").scrollIntoView(true);
        }, 1000);
      }
    } catch (e) {
      console.log(e.message);
    }
  }
}

async function genCurrentIncidentReport() {
  const response = await fetch(
    "incidents/active.json"
  );
  if (response.ok) {
    const json = await response.json();
    try {
      var reportsActual = ""
      for (let key in json) {
        if(key){
          const currentReport = json[key];
          const currentReportArray = currentReport.split("-_-");
          if(currentReportArray[1].length>0){
            reportsActual+=`<div id="${key}"><span>${currentReportArray[0]}</span><h1>${currentReportArray[1]}</h1><h2>${key}</h2><p>${currentReportArray[2]}</p><h4>${currentReportArray[3]}</h4></div>`
          }
        }
      }
      if(reportsActual.length>0){
        document.getElementById("incidents").innerHTML = `<div class="statusContainer"><div class="statusHeader"><h3 class="incidentReportsHeader">Incident Reports</h3></div><h4>Active Reports</h4><div id="activeIncidentReports">${reportsActual}</div></div>`;
      } else {
        document.getElementById("incidents").innerHTML = `<div class="statusContainer"><div class="statusHeader"><h3 class="incidentReportsHeader">Incident Reports</h3></div><h4>Active Reports</h4><div id="activeIncidentReports">Nothing active to report</div></div>`;
      }
    } catch (e) {
      console.log(e.message);
    }
  }
}

async function genHistoricalIncidents() {
  const response = await fetch(
    "incidents/inactive.json"
  );
  if (response.ok) {
    const json = await response.json();
    try {
      var reportsActual = ""
      for (let key in json) {
        if(key){
          const currentReport = json[key];
          const currentReportArray = currentReport.split("-_-");
          if(currentReportArray[1].length>0){
            reportsActual+=`<div id="${key}"><span>${currentReportArray[0]}</span><h1>${currentReportArray[1]}</h1><h2>${key}</h2><p>${currentReportArray[2]}</p><h4>${currentReportArray[3]}</h4></div>`
          }
        }
      }
      if(reportsActual.length>0){
        document.getElementById("incidents").innerHTML = `<div class="statusContainer"><div class="statusHeader"><h3 class="incidentReportsHeader">Incident Reports</h3></div><h4>Inactive Reports</h4><div id="inActiveIncidentReports">${reportsActual}</div></div>`;
      } else {
        document.getElementById("incidents").innerHTML = `<div class="statusContainer"><div class="statusHeader"><h3 class="incidentReportsHeader">Incident Reports</h3></div><h4>Inactive Reports</h4><div id="inActiveIncidentReports">Nothing historical to report</div></div>`;
      }
    } catch (e) {
      console.log(e.message);
    }
  }
}

async function getConfigurationType() {
  const response = await fetch(
    "configuration/configuration.json"
  );
  if (response.ok) {
    const json = await response.json();
    try {
      for (let key in json) {
        if(key){
          const domain = document.getElementById(`${key}-configuration`);
          domain.classList.remove("unknown");
          if(json[key] == "Normal"){
            domain.classList.add("normal");
            domain.innerText = "Config Normal";
          } else if(json[key] == "Extra Security"){
            domain.classList.add("secure");
            domain.innerText = "Config Extra Security";
          } else {
            domain.classList.add("unknown");
            domain.innerText = "Config Unknown";
          }
        }
      }
    } catch (e) {
      console.log(e.message);
    }
  }
}

async function getDNSstatus() {
  const response = await fetch(
    "dns/dns.json"
  );
  if (response.ok) {
    const json = await response.json();
    try {
      for (let key in json) {
        if(key){
          const domain = document.getElementById(`${key}-dns-status`);
          domain.classList.remove("unknown");
          if(json[key] == "up"){
            domain.classList.add("up");
            domain.innerText = "DNS Up";
          } else if(json[key] == "down"){
            domain.classList.add("down");
            domain.innerText = "DNS Down";
          } else {
            domain.classList.add("unknown");
            domain.innerText = "DNS ?";
          }
        }
      }
    } catch (e) {
      console.log(e.message);
    }
  }
}

async function getSecurityAlerts() {
  const response = await fetch(
    "security/security.json"
  );
  if (response.ok) {
    const json = await response.json();
    try {
      for (let key in json) {
        if(key){
          const domain = document.getElementById(`${key}-security`);
          domain.classList.remove("unknown");
          if(json[key] == "secure"){
            domain.classList.add("secure");
            domain.innerText = "DNS Verified";
          } else if(json[key] == "insecure"){
            domain.classList.add("insecure");
            domain.innerText = "DNS Mismatch";
          } else {
            domain.classList.add("unknown");
            domain.innerText = "DNS Security Unknown";
          }
        }
      }
    } catch (e) {
      console.log(e.message);
    }
  }
}

window.addEventListener('load', function () {   
  const checkUptimes = document.getElementById("check-uptimes");
  const checkIncidents = document.getElementById("check-current-incidents");
  const checkHistory = document.getElementById("check-previous-incidents");

  checkUptimes.addEventListener("click", function() {
    const reports = document.getElementById("reports");
    reports.innerHTML = "";
    const incidents = document.getElementById("incidents");
    incidents.innerHTML = "";
    genAllReports();
    checkIncidents.classList.remove("active");
    checkHistory.classList.remove("active");
    checkUptimes.classList.add("active");
    setTimeout(getConfigurationType, 1500);
    setTimeout(getDNSstatus, 1500);
    setTimeout(getSecurityAlerts, 1500);
  });

  checkIncidents.addEventListener("click", function() {
    const reports = document.getElementById("reports");
    reports.innerHTML = "";
    const incidents = document.getElementById("incidents");
    incidents.innerHTML = "";
    genCurrentIncidentReport();
    checkUptimes.classList.remove("active");
    checkHistory.classList.remove("active");
    checkIncidents.classList.add("active");
  });

  checkHistory.addEventListener("click", function() {
    const reports = document.getElementById("reports");
    reports.innerHTML = "";
    const incidents = document.getElementById("incidents");
    incidents.innerHTML = "";
    genHistoricalIncidents();
    checkUptimes.classList.remove("active");
    checkIncidents.classList.remove("active");
    checkHistory.classList.add("active");
  });

  //genIncidentReport(); 
  genAllReports();
  setTimeout(getConfigurationType, 1500);
  setTimeout(getDNSstatus, 1500);
  setTimeout(getSecurityAlerts, 1500);
});