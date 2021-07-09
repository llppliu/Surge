/*
Surge 4流量信息



*/

let now = new Date();
let today = now.getDate();
let month = now.getMonth();
let year = now.getFullYear();
let params = getUrlParams($request.url);
let resetDay = parseInt(params["due_day"] || params["reset_day"]);
let resetLeft = getRmainingDays(resetDay);
let delay = 0;

(async () => {
  let is_enhanced = await is_enhanced_mode();
  if (is_enhanced) delay = 2000;
  let usage = await getDataUsage(params.url);
  let used = usage.download + usage.upload;
  let total = usage.total;
  let expire = usage.expire || params.expire;
  let localProxy = "=http, localhost, 6152";
  let infoList = [`已用流量：${bytesToSize(used)} | ${bytesToSize(total)}`];

  if (resetLeft) {
    infoList.push(`重置日期：剩余${resetLeft}天`);
  }
  if (expire) {
    if (/^[\d]+$/.test(expire)) expire *= 1000;
    infoList.push(`套餐到期：${formatTime(expire)}`);
  }
  sendNotification(used / total, expire, infoList);
  let body = infoList.map((item) => item + localProxy).join("\n");
  $done({ response: { body } });
})();

function getUrlParams(url) {
  return Object.fromEntries(
    url
      .slice(url.indexOf("?") + 1)
      .split("&")
      .map((item) => item.split("="))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}

function getUserInfo(url) {
  let request = { headers: { "User-Agent": "Quantumult%20X" }, url };
  return new Promise((resolve) =>
    setTimeout(
      () =>
        $httpClient.head(request, (err, resp) => {
          if (err) $done();
          resolve(
            resp.headers[
              Object.keys(resp.headers).find(
                (key) => key.toLowerCase() === "subscription-userinfo"
              )
            ]
          );
        }),
      delay
    )
  );
}

async function getDataUsage(url) {
  let info = await getUserInfo(url);
  if (!info) {
    $notification.post("SubInfo", "", "链接响应头不带有流量信息");
    $done();
  }
  return Object.fromEntries(
    info
      .match(/\w+=\d+/g)
      .map((item) => item.split("="))
      .map(([k, v]) => [k, parseInt(v)])
  );
}

function getRmainingDays(resetDay) {
  if (!resetDay) return 0;
  let daysInMonth = new Date(year, month + 1, 0).getDate();
  if (resetDay > today) daysInMonth = 0;

  return daysInMonth - today + resetDay;
}

function bytesToSize(bytes) {
  if (bytes === 0) return "0B";
  let k = 1024;
  sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
}

function formatTime(time) {
  let dateObj = new Date(time);
  let year = dateObj.getFullYear();
  let month = dateObj.getMonth() + 1;
  let day = dateObj.getDate();
  return year + "年" + month + "月" + day + "日";
}

function sendNotification(usageRate, expire, infoList) {
  if (!params.alert) return;
  let title = params.title || "Sub Info";
  let subtitle = infoList[0];
  let body = infoList.slice(1).join("\n");
  usageRate = usageRate * 100;

  if (resetDay <= today) month += 1;
  let resetTime = new Date(year, month, resetDay);
  //通知计数器，每月重置日重置
  let notifyCounter = JSON.parse($persistentStore.read(title) || "{}");
  if (!notifyCounter[resetTime]) {
    notifyCounter = {
      [resetTime]: { usageRate: 80, resetLeft: 3, expire: 31, resetDay: 1 },
    };
  }

  let count = notifyCounter[resetTime];

  if (usageRate > count.usageRate && resetDay != today) {
    $notification.post(
      `${title} | 剩余流量不足${Math.ceil(100 - usageRate)}%`,
      subtitle,
      body
    );
    while (usageRate > count.usageRate) {
      if (count.usageRate < 95) {
        count.usageRate += 5;
      } else {
        count.usageRate += 4;
      }
    }
  }
  if (resetLeft && resetLeft < count.resetLeft && resetDay != today) {
    $notification.post(
      `${title} | 流量将在${resetLeft}天后重置`,
      subtitle,
      body
    );
    count.resetLeft = resetLeft;
  }
  if (resetDay == today && count.resetDay && usageRate < 5) {
    $notification.post(`${title} | 流量已重置`, subtitle, body);
    count.resetDay = 0;
  }
  if (expire) {
    let diff = (new Date(expire) - now) / (1000 * 3600 * 24);
    if (diff < count.expire) {
      $notification.post(
        `${title} | 套餐剩余时间不足${Math.ceil(diff)}天`,
        subtitle,
        body
      );
      count.expire -= 5;
    }
  }
  $persistentStore.write(JSON.stringify(notifyCounter), title);
}

async function is_enhanced_mode() {
  return new Promise((resolve) =>
    $httpAPI("GET", "v1/features/enhanced_mode", {}, (data) => {
      resolve(data.enabled);
    })
  );
}
