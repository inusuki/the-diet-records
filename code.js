var TOKEN = PropertiesService.getScriptProperties().getProperty("TOKEN");
var CHANNEL_NAME = PropertiesService.getScriptProperties().getProperty("CHANNEL_NAME");
var SPREAD_SHEET_ID  = PropertiesService.getScriptProperties().getProperty("SPREAD_SHEET_ID");
var SPREAD_SHEET_NAME = 'sheet';

// slackの投稿に応じて関数を実行
function doPost(e) {

  // パラメータ
  var postData = JSON.parse(e.postData.getDataAsString());


  // 認証
  if (postData.type == "url_verification") {
    return ContentService.createTextOutput(postData.challenge);
  }
  
  // 処理要否を判定  
  if　(postData.event.subtype == "bot_message") {
    return;
  }

  // テキストを取得
  var text = postData.event.text;
    
  // 検索キーワードを登録
  if (text.slice(0,1) === "調") {
    var keyword = text.split(/\s/)[1];
    insertData(keyword);
  }
    
  // 答弁を投稿
  if (text.slice(0,2) === "報告") {
    postSpeeches()
  }

}

// 検索キーワードをスプレッドシートに入力
function insertData (keyword) {
  var spreadsheet = SpreadsheetApp.openById(SPREAD_SHEET_ID);
  var recordsheet = spreadsheet.getSheetByName(SPREAD_SHEET_NAME);
  var lastrow = recordsheet.getLastRow();
  var recordrow = lastrow + 1;

//  // セルを指定してdataを入力
//  recordsheet.getRange("A" + recordrow).setValue(keyword);

  // A1セルを指定してdataを入力
  //// APIが単独キーワード検索にしか対応していないため
  //// いずれ複数キーワード検索ができるように工夫したい
  recordsheet.getRange("A" + 1).setValue(keyword);

  // 入力完了をSlackへ通知
  postSlack("承知いたしました。【" + keyword + "】について調査させていただきますね:pencil:");
}

// botからSlackへの投稿
function postSlack(message){

  var payload = 
  {
    "token" : TOKEN,
    "channel" :  CHANNEL_NAME,
    "text" : message
  };
  
  var options =
  {
    "method" : "post",
    "contentType" : "application/x-www-form-urlencoded",
    "payload" : payload
  };
 
  UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", options);

}

// 答弁を投稿
function postSpeeches() {
  var keywords = getKeywords();
  var from = getPeriod();
  var recordsJSON = getRecords(keywords, from);
  
  var keywordsText = `${keywords[0]}`
  for (var i = 1; i < keywords.length ; i++) {
    keywordsText += `/${keywords[i]}`
  }
  
  var numberOfRecords = getNumberofRecords(recordsJSON);
  postSlack(`この2週間で【${keywordsText}】を含む${numberOfRecords}件の質問・答弁がありました。最新の10件のみご報告させていただきます:page_facing_up:`)

  var messages = generateMessages(recordsJSON);
  for (var message of messages) {  
    postSlack(message);
  }
}

// 最新のキーワードを取得
function getKeywords() {
  var spreadsheet = SpreadsheetApp.openById(SPREAD_SHEET_ID);
  var recordsheet = spreadsheet.getSheetByName(SPREAD_SHEET_NAME);
  var lastrow = recordsheet.getLastRow();
  
  var keywords = [];
  for (var i = 1; i < (lastrow + 1); i ++ ){
    keywords.push(recordsheet.getRange("A" + i).getValue())
  }
  return keywords;
}

// 期間を取得
function getPeriod() {
  var date = new Date();
  date.setDate(date.getDate() - 14);
  var from = `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`
  return from;
}

// レコードを取得
function getRecords(keywords, from) {
  var keywordsEncode = `${encodeURI(keywords[0])}`;
  for (var i = 1; i < keywords.length; i++) {
    keywordsEncode += "%20" + `${encodeURI(keywords[i])}`
  }
  Logger.log(keywordsEncode);
  var url = `https://kokkai.ndl.go.jp/api/speech?any=${keywordsEncode}&from=${from}&recordPacking=JSON&startRecord=1&maximumRecords=10`;
  var records = UrlFetchApp.fetch(url).getContentText();
  var recordsJSON = JSON.parse(records)
  return recordsJSON;
}

// レコードの総数を取得
function getNumberofRecords(recordsJSON) {
  var numberOfRecords = recordsJSON["numberOfRecords"];
  return numberOfRecords  
}

// レコードをslackへの投稿として整形
function generateMessages(recordsJSON){
  var speechRecords = recordsJSON["speechRecord"];
  var messages = []
  for (var speechRecord of speechRecords) {
    var date = speechRecord["date"]
    var nameOfHouseAndMeeting = speechRecord["nameOfHouse"] + speechRecord["nameOfMeeting"]
    var speaker = (speechRecord["speakerGroup"]) ? speechRecord["speaker"] + "（" + speechRecord["speakerGroup"] + "）" : +  speechRecord["speaker"] + "（" + speechRecord["speakerPosition"] + "）" 
    var speech = speechRecord["speech"]
    var speechURL = speechRecord["speechURL"]
    var message = `${date}\n`
      + `${nameOfHouseAndMeeting}\n`
      + `${speaker}\n`
      + `${speechURL}\n`
      + `\`\`\`${speech}\`\`\``
    messages.push(message)
   }
  return messages
}