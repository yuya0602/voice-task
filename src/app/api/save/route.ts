import { google } from "googleapis";
import { NextResponse } from "next/server";
import { Readable } from "stream";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get("audio") as Blob;
        const taskDataStr = formData.get("taskData") as string;

        if (!audioFile || !taskDataStr) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        const taskData = JSON.parse(taskDataStr);
        const {
            response_date,
            client_name_kanji,
            client_name_kana,
            subject,
            content
        } = taskData;

        const token = req.headers.get("Authorization")?.replace("Bearer ", "");

        let drive, sheets;

        if (token) {
            const oAuth2Client = new google.auth.OAuth2();
            oAuth2Client.setCredentials({ access_token: token });
            drive = google.drive({ version: 'v3', auth: oAuth2Client });
            sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
        } else {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Upload Audio
        const buffer = Buffer.from(await audioFile.arrayBuffer());
        const stream = Readable.from(buffer);

        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const fileBaseName = `${response_date}_${client_name_kanji || 'NoClient'}`;

        const audioFileRes = await drive.files.create({
            requestBody: {
                name: `${fileBaseName}.webm`,
                parents: folderId ? [folderId] : [],
            },
            media: {
                mimeType: 'audio/webm',
                body: stream,
            },
        });

        // 2. Upload Transcript
        await drive.files.create({
            requestBody: {
                name: `${fileBaseName}_TRANSCRIPT.txt`,
                parents: folderId ? [folderId] : [],
            },
            media: {
                mimeType: 'text/plain',
                body: content,
            },
        });

        // 3. Append to Sheets
        // 列: A=対応日, B=顧客名(漢字), C=顧客名(カナ), D=担当者, E=件名, F=内容, G=対応手段, H=処理日時(空欄)
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (sheetId) {
            await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: 'シート1!A:G',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [
                        [
                            response_date,
                            client_name_kanji,
                            client_name_kana,
                            '竹田健介',
                            subject,
                            content,
                            '電話'
                        ]
                    ]
                }
            });
        }

        return NextResponse.json({ success: true, fileId: audioFileRes.data.id });

    } catch (error: any) {
        console.error("Save API Error:", error);
        const message =
            error?.response?.data?.error?.message ||
            error?.errors?.[0]?.message ||
            error?.message ||
            "Failed to save data";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
