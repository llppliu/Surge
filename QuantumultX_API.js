// obj['country']
if ($response.statusCode != 200) {
  $done(Null);
}

var body = $response.body;
var obj = JSON.parse(body);
var title = '🔞'
var subtitle = ' '
var ip = obj['query'];
var description = "位置" + ":" + obj['city'] + '\n'+'IP:'+ obj['query'] + '\n' + "服务商" + ":" + obj['isp'] +  '\n' + "数据中心" + ":" + obj['org'] + '\n' +'时区:'+ obj['timezone'];
$done({title, subtitle, ip, description});
