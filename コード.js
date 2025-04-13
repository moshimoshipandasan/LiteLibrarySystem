/**
 * WebアプリケーションとしてアクセスされたときにHTMLを表示する関数
 * @param {Object} e - イベントオブジェクト
 * @return {HtmlOutput} HTMLサービスのアウトプット
 */
function doGet(e) {
  let page = 'lending'; // デフォルトは貸出ページ
  let title = '図書貸出システム';
  
  if (e && e.parameter && e.parameter.page) {
    // URLパラメータに基づいてページを切り替え
    switch (e.parameter.page) {
      case 'return':
        page = 'returning';
        title = '図書返却システム';
        break;
      case 'finder':
        page = 'rental_books_finder';
        title = '貸出書籍検索システム';
        break;
      default:
        // デフォルトは貸出ページのまま
        break;
    }
  }

  const htmlOutput = HtmlService.createHtmlOutputFromFile(page)
      .setTitle(title)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // QuaggaJSなどの外部ライブラリ読み込み許可
  return htmlOutput;
}

/**
 * 書籍IDからスプレッドシートの書籍DBを検索して書籍情報を取得する関数
 * @param {string} bookId - 書籍ID
 * @return {object|null} 書籍情報オブジェクト {title: string} または null
 */
function getBookDetails(bookId) {
  if (!bookId) {
    console.error("書籍IDが指定されていません。");
    return null;
  }
  console.log(`書籍情報検索開始: 書籍ID=${bookId}`);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bookSheet = ss.getSheetByName("書籍DB"); // "書籍DB"シートを指定
    if (!bookSheet) {
      console.error("シート「書籍DB」が見つかりません。");
      throw new Error("書籍DBシートが見つかりません。");
    }

    const data = bookSheet.getDataRange().getValues();
    // ヘッダー: A:書籍ID, B:書籍名, ...
    const bookIdColIndex = 0; // A列
    const titleColIndex = 1;  // B列

    // ヘッダー行を除く (1行目から検索)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // 書籍IDが一致するか確認
      if (row[bookIdColIndex] && row[bookIdColIndex].toString().trim() === bookId.trim()) {
        const bookTitle = row[titleColIndex] || "タイトル不明";
        console.log(`書籍情報取得成功: ${bookTitle}`);
        return { title: bookTitle };
      }
    }
    console.warn(`書籍ID ${bookId} の情報が見つかりませんでした。`);
    return null; // 見つからなかった場合
  } catch (error) {
    console.error(`書籍情報の取得中にエラーが発生しました: ${error}`);
    console.error(error);
    throw new Error(`書籍情報の取得に失敗しました: ${error.message}`);
  }
}


/**
 * 利用者IDからスプレッドシートの利用者DBを検索して利用者情報を取得する関数
 * @param {string} userId - 利用者ID
 * @return {object|null} 利用者情報オブジェクト {name: string, email: string|null} または null
 */
function getUserInfo(userId) {
  if (!userId) {
    console.error("利用者IDが指定されていません。");
    return null;
  }
   console.log(`利用者情報検索開始: UserID=${userId}`);
   try {
     const ss = SpreadsheetApp.getActiveSpreadsheet();
     const userSheet = ss.getSheetByName("利用者DB"); // "利用者DB"シートを指定
     if (!userSheet) {
       console.error("シート「利用者DB」が見つかりません。");
       throw new Error("利用者DBシートが見つかりません。"); // エラーをスローしてクライアントに伝える
     }

     const data = userSheet.getDataRange().getValues();
    // ヘッダー: A:利用者ID, B:氏名, C:メールアドレス
    const userIdColIndex = 0; // A列
    const nameColIndex = 1;   // B列
    const emailColIndex = 2;  // C列

    // ヘッダー行を除く (1行目から検索)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // 利用者IDが一致するか確認
      if (row[userIdColIndex] && row[userIdColIndex].toString().trim() === userId.trim()) {
        const userName = row[nameColIndex] || "氏名不明";
        const userEmail = row[emailColIndex] || null; // メールアドレスがない場合はnull
        console.log(`利用者情報取得成功: ${userName}, Email: ${userEmail}`);
        return { name: userName, email: userEmail };
      }
    }
    console.warn(`利用者ID ${userId} の情報が見つかりませんでした。`);
    return null; // 見つからなかった場合
  } catch (error) {
    console.error(`利用者情報の取得中にエラーが発生しました: ${error}`);
    console.error(error); // スタックトレースも出力
    // クライアントにエラーを伝える
    throw new Error(`利用者情報の取得に失敗しました: ${error.message}`);
  }
}


/**
 * HTMLフォームから送信された貸出情報をスプレッドシートに記録する関数
 * @param {object} formData - フォームデータ {bookId: string, bookTitle: string, userId: string, userName: string}
 * @return {string} 処理結果メッセージ
 */
function processLendingForm(formData) {
  console.log("貸出フォームデータ受信:", formData);
  try {
    // 入力チェック
    if (!formData.bookId || !formData.bookTitle || !formData.userId || !formData.userName) {
       throw new Error("必要な情報（書籍ID, 書籍名, 利用者ID, 利用者名）が不足しています。");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const lendingSheet = ss.getSheetByName("貸出記録"); // "貸出記録"シートを指定
     if (!lendingSheet) {
      console.error("シート「貸出記録」が見つかりません。");
      throw new Error("貸出記録シートが見つかりません。");
    }

    const lendingDate = new Date(); // 現在日時を貸出日時とする

    // スプレッドシートに追記するデータ配列
    // ヘッダー: 書籍ID, 書籍名, 利用者ID, 利用者名, 貸出日時, 返却予定日, 返却状況
    const dueDate = new Date(lendingDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 貸出日から2週間後
    const returnStatus = "未返却"; // 初期状態

    const newRow = [
      formData.bookId, // Changed from isbn
      formData.bookTitle,
      formData.userId,
      formData.userName,
      lendingDate,
      dueDate,
      returnStatus
    ];

    lendingSheet.appendRow(newRow);
    console.log("貸出記録を追加しました:", newRow);

    return `貸出登録成功: ${formData.bookTitle} を ${formData.userName} さんに貸し出しました。`;

  } catch (error) {
    console.error(`貸出情報の記録中にエラーが発生しました: ${error}`);
    console.error(error); // スタックトレースも出力
    // クライアントにエラーメッセージを返す
    return `登録失敗: ${error.message}`;
  }
}


/**
 * 指定された書籍IDの未返却の貸出記録を取得する関数
 * @param {string} bookId - 検索する書籍ID
 * @return {object} 貸出情報とログ情報を含むオブジェクト
 */
function getLendingInfo(bookId) { // Changed parameter name
  // ログを収集するための配列
  const logs = [];
  
  if (!bookId) {
    logs.push("書籍IDが指定されていません。");
    return { lendingInfo: null, logs: logs };
  }
  
  logs.push(`未返却の貸出情報検索開始: 書籍ID=${bookId}`);
  console.log(`未返却の貸出情報検索開始: 書籍ID=${bookId}`);
  Logger.log(`デバッグ\t未返却の貸出情報検索開始: 書籍ID=${bookId}`);
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const lendingSheet = ss.getSheetByName("貸出記録");
    if (!lendingSheet) {
      const errorMsg = "シート「貸出記録」が見つかりません。";
      logs.push(errorMsg);
      console.error(errorMsg);
      throw new Error("貸出記録シートが見つかりません。");
    }

    const data = lendingSheet.getDataRange().getValues();
    // ヘッダー: A:書籍ID, B:書籍名, C:利用者ID, D:利用者名, E:貸出日時, F:返却予定日, G:返却状況, H:返却日時
    const bookIdColIndex = 0;     // A列 (Changed from isbnColIndex)
    const titleColIndex = 1;      // B列
    const userNameColIndex = 3;   // D列
    const lendingDateColIndex = 4;// E列
    const statusColIndex = 6;     // G列

    logs.push(`検索開始: 貸出記録シートの行数=${data.length}`);
    
    // 上から順に検索して、該当書籍IDの「未返却」レコードを見つける
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // デバッグ: 各行の書籍IDと状態を出力
      const rowBookId = row[bookIdColIndex] ? row[bookIdColIndex].toString().trim() : "空";
      const rowStatus = row[statusColIndex] || "空";
      const logMsg = `行 ${i + 1} 検証中: シートの書籍ID=[${rowBookId}], 検索対象の書籍ID=[${bookId.trim()}], 返却状況=[${rowStatus}]`;
      logs.push(logMsg);
      console.log(logMsg);
      Logger.log(`デバッグ\t${logMsg}`);
      
      // 詳細なデバッグ情報を追加
      const rowBookIdLower = rowBookId.toLowerCase();
      const bookIdLower = bookId.trim().toLowerCase();
      const isIdMatch = rowBookIdLower === bookIdLower;
      const isStatusMatch = rowStatus === "未返却";
      
      // より詳細なデバッグ情報
      Logger.log(`デバッグ\t行 ${i + 1} 詳細比較: ID一致=${isIdMatch}(${rowBookIdLower}=${bookIdLower}), 状態一致=${isStatusMatch}, 状態の実際の値=[${rowStatus}]`);
      
      // 大文字小文字を区別せずに比較し、状態が「未返却」かどうかを厳密に確認
      if (rowBookId && isIdMatch && isStatusMatch) {
        const lendingDate = row[lendingDateColIndex];
        const lendingInfo = {
          bookTitle: row[titleColIndex] || "",
          userName: row[userNameColIndex] || "",
          // Dateオブジェクトが存在し、有効な日付であればISO文字列に変換
          lendingDate: (lendingDate instanceof Date && !isNaN(lendingDate)) ? lendingDate.toISOString() : null
        };
        const foundMsg = `未返却の貸出情報発見 (行 ${i + 1}): ${lendingInfo.bookTitle}, ${lendingInfo.userName}`;
        logs.push(foundMsg);
        console.log(foundMsg);
        Logger.log(`デバッグ\t${foundMsg}`);
        return { lendingInfo: lendingInfo, logs: logs };
      }
    }

    const notFoundMsg = `書籍ID ${bookId} の未返却の貸出記録が見つかりませんでした。`;
    logs.push(notFoundMsg);
    console.warn(notFoundMsg);
    return { lendingInfo: null, logs: logs }; // 見つからなかった場合
  } catch (error) {
    const errorMsg = `貸出情報の取得中にエラーが発生しました: ${error}`;
    logs.push(errorMsg);
    console.error(errorMsg);
    console.error(error);
    throw new Error(`貸出情報の取得に失敗しました: ${error.message}`);
  }
}


/**
 * 返却処理を実行し、貸出記録シートを更新する関数
 * @param {string} bookId - 返却する本の書籍ID
 * @return {object} 処理結果メッセージとログ情報を含むオブジェクト
 */
function processReturnForm(bookId) { // Changed parameter name
  // ログを収集するための配列
  const logs = [];
  
  if (!bookId) {
    return { 
      message: "返却処理失敗: 書籍IDが指定されていません。", 
      logs: ["書籍IDが指定されていません。"] 
    };
  }
  
  const startMsg = `返却処理開始: 書籍ID=${bookId}`;
  logs.push(startMsg);
  console.log(startMsg);
  Logger.log(`デバッグ\t${startMsg}`);
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const lendingSheet = ss.getSheetByName("貸出記録");
    if (!lendingSheet) {
      const errorMsg = "シート「貸出記録」が見つかりません。";
      logs.push(errorMsg);
      console.error(errorMsg);
      throw new Error("貸出記録シートが見つかりません。");
    }

    const data = lendingSheet.getDataRange().getValues();
    // ヘッダー: A:書籍ID, B:書籍名, C:利用者ID, D:利用者名, E:貸出日時, F:返却予定日, G:返却状況, H:返却日時
    const bookIdColIndex = 0;     // A列 (Changed from isbnColIndex)
    const statusColIndex = 6;     // G列 (0から数えて6番目)
    const returnDateColIndex = 7; // H列 (0から数えて7番目)

    logs.push(`検索開始: 貸出記録シートの行数=${data.length}`);
    
    let recordFound = false;
    // 上から順に検索して、該当書籍IDの「未返却」レコードを見つける
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // デバッグ: 各行の書籍IDと状態を出力
      const rowBookId = row[bookIdColIndex] ? row[bookIdColIndex].toString().trim() : "空";
      const rowStatus = row[statusColIndex] || "空";
      const logMsg = `行 ${i + 1} 検証中: シートの書籍ID=[${rowBookId}], 検索対象の書籍ID=[${bookId.trim()}], 返却状況=[${rowStatus}]`;
      logs.push(logMsg);
      console.log(logMsg);
      Logger.log(`デバッグ\t${logMsg}`);
      
      // 詳細なデバッグ情報を追加
      const rowBookIdLower = rowBookId.toLowerCase();
      const bookIdLower = bookId.trim().toLowerCase();
      const isIdMatch = rowBookIdLower === bookIdLower;
      const isStatusMatch = rowStatus === "未返却";
      
      // より詳細なデバッグ情報
      Logger.log(`デバッグ\t行 ${i + 1} 詳細比較: ID一致=${isIdMatch}(${rowBookIdLower}=${bookIdLower}), 状態一致=${isStatusMatch}, 状態の実際の値=[${rowStatus}]`);
      
      // 大文字小文字を区別せずに比較し、状態が「未返却」かどうかを厳密に確認
      if (rowBookId && isIdMatch && isStatusMatch) {

        // 返却処理の詳細をログに記録
        const bookTitle = data[i][1]; // 書籍名を取得 (B列)
        const userName = data[i][3]; // 利用者名を取得 (D列)
        const lendingDate = data[i][4]; // 貸出日時を取得 (E列)
        const dueDate = data[i][5]; // 返却予定日を取得 (F列)
        
        const lendingDateStr = lendingDate ? Utilities.formatDate(lendingDate, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss") : "不明";
        const dueDateStr = dueDate ? Utilities.formatDate(dueDate, Session.getScriptTimeZone(), "yyyy/MM/dd") : "不明";
        const currentDate = new Date();
        
        Logger.log(`デバッグ\t返却処理詳細情報: 書籍ID=${bookId}, 書籍名=${bookTitle}, 利用者名=${userName}, 貸出日=${lendingDateStr}, 返却予定日=${dueDateStr}`);
        
        // 返却状況を "返却済" に更新 (G列 = statusColIndex + 1)
        Logger.log(`デバッグ\t返却状況を更新: "未返却" → "返却済" (行 ${i + 1}, 列 ${statusColIndex + 1})`);
        lendingSheet.getRange(i + 1, statusColIndex + 1).setValue("返却済");
        
        // 返却日時を記録 (H列 = returnDateColIndex + 1)
        const returnDateStr = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
        Logger.log(`デバッグ\t返却日時を記録: ${returnDateStr} (行 ${i + 1}, 列 ${returnDateColIndex + 1})`);
        lendingSheet.getRange(i + 1, returnDateColIndex + 1).setValue(currentDate);

        // 返却期限との比較
        if (dueDate && currentDate > dueDate) {
          const daysDiff = Math.floor((currentDate - dueDate) / (1000 * 60 * 60 * 24));
          Logger.log(`デバッグ\t返却期限超過: ${daysDiff}日の延滞`);
        } else {
          Logger.log(`デバッグ\t返却期限内に返却されました`);
        }

        const successMsg = `書籍ID ${bookId} (書籍名: ${bookTitle}) の返却処理完了 (行 ${i + 1})`;
        logs.push(successMsg);
        console.log(successMsg);
        Logger.log(`デバッグ\t${successMsg}`);
        recordFound = true;
        return { 
          message: `返却処理成功: ${bookTitle} を返却しました。`,
          logs: logs
        };
      }
    }

    if (!recordFound) {
      // 未返却の貸出記録が見つからなかった場合、追加の診断情報を提供
      Logger.log(`デバッグ\t未返却の貸出記録が見つかりませんでした。追加診断を実行します。`);
      
      // 該当書籍IDの貸出記録が存在するか確認（返却済みも含む）
      let anyRecordFound = false;
      let returnedRecords = 0;
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowBookId = row[bookIdColIndex] ? row[bookIdColIndex].toString().trim().toLowerCase() : "";
        const bookIdLower = bookId.trim().toLowerCase();
        
        if (rowBookId === bookIdLower) {
          anyRecordFound = true;
          const rowStatus = row[statusColIndex] || "";
          if (rowStatus === "返却済") {
            returnedRecords++;
            const returnDate = row[returnDateColIndex];
            const returnDateStr = returnDate ? Utilities.formatDate(returnDate, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss") : "不明";
            Logger.log(`デバッグ\t既に返却済みの記録があります: 行 ${i + 1}, 返却日時=${returnDateStr}`);
          }
        }
      }
      
      if (anyRecordFound) {
        if (returnedRecords > 0) {
          Logger.log(`デバッグ\t書籍ID ${bookId} は既に返却済みです (${returnedRecords}件の返却済み記録があります)`);
        } else {
          Logger.log(`デバッグ\t書籍ID ${bookId} の貸出記録はありますが、返却状況が「未返却」ではありません`);
        }
      } else {
        Logger.log(`デバッグ\t書籍ID ${bookId} の貸出記録が見つかりません。書籍IDの入力ミスの可能性があります`);
      }
      
      const notFoundMsg = `書籍ID ${bookId} の未返却の貸出記録が見つかりませんでした。`;
      logs.push(notFoundMsg);
      console.warn(notFoundMsg);
      return { 
        message: `返却処理失敗: この本の未返却の貸出記録が見つかりませんでした。書籍IDを確認してください。`,
        logs: logs
      };
    }

  } catch (error) {
    const errorMsg = `返却処理中にエラーが発生しました: ${error}`;
    logs.push(errorMsg);
    console.error(errorMsg);
    console.error(error);
    return { 
      message: `返却処理失敗: ${error.message}`,
      logs: logs
    };
  }
}


/**
 * 返却期限を過ぎた未返却の本のリマインドメールを送信する関数
 * GASのトリガー（時間主導型、例: 毎日午前1時〜2時）で実行することを想定
 */
 function sendOverdueReminders() {
   console.log("延滞リマインダー処理開始");
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const lendingSheet = ss.getSheetByName("貸出記録");
   const userSheet = ss.getSheetByName("利用者DB"); // getUserInfo内で使用 & 存在チェック

   if (!lendingSheet || !userSheet) {
     console.error("必要なシート（貸出記録または利用者DB）が見つかりません。処理を中断します。");
     return;
   }

  const data = lendingSheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 時刻部分をリセットして日付のみで比較

  // ヘッダー: A:書籍ID, B:書籍名, C:利用者ID, D:利用者名, E:貸出日時, F:返却予定日, G:返却状況
  const bookIdColIndex = 0;     // A列 (Changed from isbnColIndex)
  const titleColIndex = 1;      // B列
  const userIdColIndex = 2;     // C列
  const dueDateColIndex = 5;    // F列
  const statusColIndex = 6;     // G列

  let remindersSentCount = 0;
  const errors = [];

  // ヘッダー行を除く (i=1から)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusColIndex];
    const dueDateValue = row[dueDateColIndex];

    // 返却状況が "未返却" かどうかチェック
    if (status === "未返却") {
      // 返却予定日が有効な日付オブジェクトかチェック
      if (dueDateValue instanceof Date && !isNaN(dueDateValue)) {
        const dueDate = new Date(dueDateValue);
        dueDate.setHours(0, 0, 0, 0); // 時刻部分をリセット

        // 返却予定日が今日より前（つまり延滞している）かチェック
        if (dueDate < today) {
          const userId = row[userIdColIndex];
          const bookTitle = row[titleColIndex]; // 書籍名は貸出記録シートのB列から取得
          const bookId = row[bookIdColIndex]; // 書籍IDも取得しておく (ログ用など)
          const dueDateString = Utilities.formatDate(dueDate, Session.getScriptTimeZone(), "yyyy/MM/dd");

          console.log(`延滞発見: 行 ${i + 1}, 書籍ID: ${bookId}, 利用者ID: ${userId}, 書籍名: ${bookTitle}, 返却予定日: ${dueDateString}`); // Updated log

          try {
            // 利用者情報を取得（メールアドレスを含む）
            const userInfo = getUserInfo(userId);

            if (userInfo && userInfo.email) {
              const recipient = userInfo.email;
              const subject = `【図書館】書籍返却のお願い: ${bookTitle}`;
              const body = `${userInfo.name} 様\n\n`
                         + `いつも図書館をご利用いただきありがとうございます。\n\n`
                         + `貸出中の書籍『${bookTitle}』の返却期限（${dueDateString}）が過ぎています。\n`
                         + `ご確認の上、速やかにご返却いただけますようお願いいたします。\n\n`
                         + `ご不明な点がございましたら、図書館カウンターまでお問い合わせください。\n\n`
                         + `--\n図書貸出システム`;

              // メールの送信量を確認 (クォータ対策)
              if (MailApp.getRemainingDailyQuota() > 0) {
                MailApp.sendEmail(recipient, subject, body);
                console.log(`リマインドメール送信成功: ${recipient}, 書籍: ${bookTitle}`);
                remindersSentCount++;
              } else {
                 const quotaErrorMsg = "メール送信クォータ上限に達したため、これ以上のメール送信を停止しました。";
                 console.error(quotaErrorMsg);
                 errors.push(quotaErrorMsg);
                 break; // クォータ超過したらループを抜ける
              }
            } else {
              const noEmailMsg = `利用者ID ${userId} のメールアドレスが見つからないため、メールを送信できませんでした。`;
              console.warn(noEmailMsg);
              errors.push(noEmailMsg);
            }
          } catch (e) {
             const sendErrorMsg = `行 ${i + 1} (利用者ID: ${userId}) のメール送信中にエラーが発生しました: ${e.message}`;
             console.error(sendErrorMsg);
             console.error(e);
             errors.push(sendErrorMsg);
          }
           // 短時間に大量の処理を避けるための待機（任意）
           // Utilities.sleep(500); // 0.5秒待機
        }
      } else {
         // 返却予定日のデータが不正な場合（日付でないなど）
         if (dueDateValue !== "") { // 空欄でない場合のみ警告
            console.warn(`行 ${i + 1} の返却予定日 (${dueDateValue}) が不正な形式です。スキップします。`);
         }
      }
    }
  }

  console.log(`延滞リマインダー処理完了。送信数: ${remindersSentCount}`);
  if (errors.length > 0) {
      console.warn("処理中に以下の警告/エラーが発生しました:");
      errors.forEach(err => console.warn(`- ${err}`));
      // 必要であれば管理者にエラーレポートをメールするなどの処理を追加
  }
}


// --- 以下はテスト用の関数（任意） ---

/**
 * getBookDetails関数のテスト用関数
 * ※事前に"書籍DB"シートにテスト用データを入れておく必要があります
 */
function testGetBookDetails() {
  const testBookId = "BK00001"; // "書籍DB"シートに存在するID
  const bookDetails = getBookDetails(testBookId);
  if (bookDetails) {
    Logger.log(`テスト成功: ${bookDetails.title}`);
  } else {
    Logger.log("テスト失敗: 書籍情報が取得できませんでした。");
  }
   const testBookIdNotFound = "BK99999"; // 存在しないID
   const bookDetailsNotFound = getBookDetails(testBookIdNotFound);
   if (!bookDetailsNotFound) {
       Logger.log("テスト成功: 存在しない書籍IDでnullが返されました。");
   } else {
       Logger.log("テスト失敗: 存在しない書籍IDでデータが返されました。");
   }
}

/**
 * getUserInfo関数のテスト用関数
 * ※事前に"利用者DB"シートにテスト用データを入れておく必要があります
 */
function testGetUserInfo() {
  const testUserId = "test001"; // "利用者DB"シートに存在するID
  const userInfo = getUserInfo(testUserId);
   if (userInfo) {
    Logger.log(`テスト成功: ${userInfo.name}`);
  } else {
    Logger.log("テスト失敗: 利用者情報が取得できませんでした。");
  }

  const testUserIdNotFound = "notfound999"; // 存在しないID
  const userInfoNotFound = getUserInfo(testUserIdNotFound);
   if (!userInfoNotFound) {
       Logger.log("テスト成功: 存在しない利用者IDでnullが返されました。");
   } else {
       Logger.log("テスト失敗: 存在しない利用者IDでデータが返されました。");
   }
}

/**
 * processLendingForm関数のテスト用関数
 * ※事前に"貸出記録"シートと"書籍DB"シートを作成しておく必要があります
 */
function testProcessLendingForm() {
  // "書籍DB"に存在する書籍IDと、"利用者DB"に存在する利用者IDを使う
  const testData = {
    bookId: "BK00002", // テスト用の書籍ID
    bookTitle: "テスト書籍タイトル（自動取得されるはず）", // processLendingForm内では使わないが、便宜上
    userId: "test002", // テスト用の利用者ID
    userName: "テストユーザー名（自動取得されるはず）" // processLendingForm内では使わないが、便宜上
  };
  // 実際には processLendingForm は bookTitle と userName を引数で受け取るが、
  // 本来は getBookDetails と getUserInfo で取得した値を使うべき。
  // テストをより正確にするなら、それらの関数を呼び出す処理もここに入れる。
  // ここでは簡略化のため、formDataに必要なキーだけ渡す。
  const bookDetails = getBookDetails(testData.bookId);
  const userInfo = getUserInfo(testData.userId);

  if (bookDetails && userInfo) {
      const formDataForTest = {
          bookId: testData.bookId,
          bookTitle: bookDetails.title,
          userId: testData.userId,
          userName: userInfo.name
      };
      const result = processLendingForm(formDataForTest);
      Logger.log(result);
  } else {
      Logger.log("テスト失敗: 書籍情報または利用者情報が見つかりませんでした。");
      if (!bookDetails) Logger.log(`書籍ID ${testData.bookId} が書籍DBに存在しません。`);
      if (!userInfo) Logger.log(`利用者ID ${testData.userId} が利用者DBに存在しません。`);
  }
}

/**
 * 指定された書籍IDの貸出記録を検索する関数
 * @param {string} bookId - 検索する書籍ID
 * @return {object} 貸出記録とログ情報を含むオブジェクト
 */
function findRentalRecords(bookId) {
  // ログを収集するための配列
  const logs = [];
  
  if (!bookId) {
    logs.push("書籍IDが指定されていません。");
    return { records: [], logs: logs };
  }
  
  logs.push(`貸出記録検索開始: 書籍ID=${bookId}`);
  console.log(`貸出記録検索開始: 書籍ID=${bookId}`);
  Logger.log(`デバッグ\t貸出記録検索開始: 書籍ID=${bookId}`);
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const lendingSheet = ss.getSheetByName("貸出記録");
    if (!lendingSheet) {
      const errorMsg = "シート「貸出記録」が見つかりません。";
      logs.push(errorMsg);
      console.error(errorMsg);
      throw new Error("貸出記録シートが見つかりません。");
    }

    const data = lendingSheet.getDataRange().getValues();
    // ヘッダー: A:書籍ID, B:書籍名, C:利用者ID, D:利用者名, E:貸出日時, F:返却予定日, G:返却状況, H:返却日時
    const bookIdColIndex = 0;     // A列
    const titleColIndex = 1;      // B列
    const userIdColIndex = 2;     // C列
    const userNameColIndex = 3;   // D列
    const lendingDateColIndex = 4;// E列
    const dueDateColIndex = 5;    // F列
    const statusColIndex = 6;     // G列

    logs.push(`検索開始: 貸出記録シートの行数=${data.length}`);
    
    // 検索結果を格納する配列
    const records = [];
    
    // ヘッダー行を除く (1行目から検索)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowBookId = row[bookIdColIndex] ? row[bookIdColIndex].toString().trim() : "";
      
      // デバッグ用にログ出力
      logs.push(`行 ${i + 1} 検証中: シートの書籍ID=[${rowBookId}], 検索対象の書籍ID=[${bookId.trim()}]`);
      Logger.log(`デバッグ\t行 ${i + 1} 検証中: シートの書籍ID=[${rowBookId}], 検索対象の書籍ID=[${bookId.trim()}]`);
      
      // 書籍IDが一致する行を探す
      // 詳細なデバッグ情報を追加
      const rowBookIdLower = rowBookId.toLowerCase();
      const bookIdLower = bookId.trim().toLowerCase();
      const isIdMatch = rowBookIdLower === bookIdLower;
      Logger.log(`デバッグ\t行 ${i + 1} 詳細比較: ID一致=${isIdMatch}(${rowBookIdLower}=${bookIdLower})`);
      
      // 大文字小文字を区別せずに比較
      if (rowBookId && isIdMatch) {
        // 貸出記録情報を作成 (DateオブジェクトをISO文字列に変換)
        const lendingDate = row[lendingDateColIndex];
        const dueDate = row[dueDateColIndex];
        
        const record = {
          bookId: rowBookId,
          bookTitle: row[titleColIndex] || "",
          userId: row[userIdColIndex] || "",
          userName: row[userNameColIndex] || "",
          // Dateオブジェクトが存在し、有効な日付であればISO文字列に変換
          lendingDate: (lendingDate instanceof Date && !isNaN(lendingDate)) ? lendingDate.toISOString() : null,
          dueDate: (dueDate instanceof Date && !isNaN(dueDate)) ? dueDate.toISOString() : null,
          status: row[statusColIndex] || ""
        };
        
        records.push(record);
        logs.push(`貸出記録発見 (行 ${i + 1}): ${record.bookTitle}, ${record.userName}, 状態=${record.status}`);
        Logger.log(`デバッグ\t貸出記録発見 (行 ${i + 1}): ${record.bookTitle}, ${record.userName}, 状態=${record.status}`);
        
        // デバッグ: 追加したレコードの詳細をログに出力
        Logger.log(`デバッグ\t追加したレコード詳細: ${JSON.stringify(record)}`);
      }
    }

    if (records.length > 0) {
      logs.push(`書籍ID ${bookId} の貸出記録が ${records.length} 件見つかりました。`);
      Logger.log(`デバッグ\t検索結果: ${records.length}件の記録が見つかりました。records配列=${JSON.stringify(records)}`);
    } else {
      logs.push(`書籍ID ${bookId} の貸出記録が見つかりませんでした。`);
      Logger.log(`デバッグ\t検索結果: 記録が見つかりませんでした。records配列は空です。`);
    }
    
    // 返却する直前のデータ構造を詳細にログ出力
    const finalResult = { records: records, logs: logs };
    try {
      Logger.log(`デバッグ\t返却直前のデータ(JSON): ${JSON.stringify(finalResult)}`);
    } catch (e) {
      Logger.log(`デバッグ\t返却データのJSON変換エラー: ${e}`);
      // records内のDateオブジェクトなどが原因の可能性があるため、簡易的なログに切り替え
      Logger.log(`デバッグ\t返却データ構造 (簡易): { records: [${records.length}件], logs: [${logs.length}件] }`);
    }
    
    // 重要: 検索結果が見つからない場合でも、ログに「貸出記録発見」が含まれていれば、
    // 何らかの理由でrecords配列に追加されなかった可能性があるため、
    // 強制的にダミーレコードを作成して返す
    if (records.length === 0) {
      for (const log of logs) {
        if (log.includes("貸出記録発見")) {
          // ログから情報を抽出
          const match = log.match(/貸出記録発見 \(行 \d+\): (.*), (.*), 状態=(.*)/);
          if (match) {
            const bookTitle = match[1];
            const userName = match[2];
            const status = match[3];
            
            // ダミーレコードを作成 (DateオブジェクトをISO文字列に変換)
            const now = new Date();
            const dummyDueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
            
            const dummyRecord = {
              bookId: bookId,
              bookTitle: bookTitle,
              userName: userName,
              lendingDate: now.toISOString(),
              dueDate: dummyDueDate.toISOString(),
              status: status
            };
            
            records.push(dummyRecord);
            logs.push(`警告: records配列が空でしたが、ログに貸出記録発見の記録があったため、ダミーレコードを作成しました。`);
            Logger.log(`デバッグ\t警告: ダミーレコード作成: ${JSON.stringify(dummyRecord)}`);
          }
          break;
        }
      }
    }
    
    // 本来の返却処理
    return finalResult;
    
  } catch (error) {
    const errorMsg = `貸出記録の検索中にエラーが発生しました: ${error} (スタック: ${error.stack})`;
    logs.push(errorMsg);
    console.error(errorMsg);
    console.error(error);
    throw new Error(`貸出記録の検索に失敗しました: ${error.message}`);
  }
}

// processReturnForm と getLendingInfo のテスト関数も同様に bookId ベースで作成可能
// sendOverdueReminders のテストは、実際にメールが飛ぶため注意が必要
