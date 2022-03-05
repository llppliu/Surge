/**
 
 */

let config = {
  silence: false, // 是否静默运行，默认false
  cellular: "RULE", // 蜂窝数据下的模式，RULE代表规则模式，PROXY代表全局代理，DIRECT代表全局直连
  wifi: "RULE", // wifi下默认的模式
  all_direct: ["WRT32X", "WRT32X Extreme"], // 指定全局直连的wifi名字
  all_proxy: [], // 指定全局代理的wifi名字
};

// load user prefs from box
const boxConfig = $persistentStore.read("surge_running_mode");
if (boxConfig) {
  config = JSON.parse(boxConfig);
  config.silence = JSON.parse(config.silence);
  config.all_direct = JSON.parse(config.all_direct);
  config.all_proxy = JSON.parse(config.all_proxy);
}

const isLoon = typeof $loon !== "undefined";
const isSurge = typeof $httpClient !== "undefined" && !isLoon;
const MODE_NAMES = {
  RULE: "规则模式",
  PROXY: "全局代理",
  DIRECT: "直接连接",
};

manager();
$done();

function manager() {
  let ssid;
  let mode;

  if (isSurge) {
    const v4_ip = $network.v4.primaryAddress;
    // no network connection
    if (!config.silence && !v4_ip) {
      notify("Surge", "无网络", "");
      return;
    }
    ssid = $network.wifi.ssid;
    mode = ssid ? lookupSSID(ssid) : config.cellular;
    const target = {
      RULE: "rule",
      PROXY: "global-proxy",
      DIRECT: "direct",
    }[mode];
    $surge.setOutboundMode(target);
  } else if (isLoon) {
    const conf = JSON.parse($config.getConfig());
    ssid = conf.ssid;
    mode = ssid ? lookupSSID(ssid) : config.cellular;
    const target = {
      DIRECT: 0,
      RULE: 1,
      PROXY: 2,
    }[mode];
    $config.setRunningModel(target);
  }
  if (!config.silence) {
    notify(
      `${isSurge ? "出站模式" : ""}  `,
      `网络：${ssid ? ssid : "蜂窝网络"}`,
      `${isSurge ? "出站模式" : ""}  ->  ${MODE_NAMES[mode]}`
    );
  }
}

function lookupSSID(ssid) {
  const map = {};
  config.all_direct.map((id) => (map[id] = "DIRECT"));
  config.all_proxy.map((id) => (map[id] = "PROXY"));

  const matched = map[ssid];
  return matched ? matched : config.wifi;
}

function notify(title, subtitle, content) {
  const SUBTITLE_STORE_KEY = "running_mode_notified_subtitle";
  const lastNotifiedSubtitle = $persistentStore.read(SUBTITLE_STORE_KEY);

  if (!lastNotifiedSubtitle || lastNotifiedSubtitle !== subtitle) {
    $persistentStore.write(subtitle.toString(), SUBTITLE_STORE_KEY);
    $notification.post(title, subtitle, content);
  }
}
