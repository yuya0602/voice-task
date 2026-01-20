import { google } from "googleapis";
import { NextResponse } from "next/server";
import { Readable } from "stream";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get("audio") as Blob;
        const taskDataStr = formData.get("taskData") as string;
        const reporter = formData.get("reporter") as string;

        if (!audioFile || !taskDataStr) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        const taskData = JSON.parse(taskDataStr);
        const { date, task_detail, assignee, client_name, full_transcript } = taskData;

        // Auth
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/spreadsheets'
            ],
        });

        // NOTE: Using Service Account is better for backend automation, 
        // but User OAuth token (from session) is also possible if passed.
        // For now assuming Service Account or User Token. 
        // If using User Token, we need to extract it from session.
        // However, the implementation plan mentioned User Identity.
        // Usually for "Company Tool" a Service Account owns the Drive/Sheet.
        // BUT the requirement says "User Identification... app executor's login info...".
        // If we use Service Account, the files are owned by Service Account.
        // Let's rely on standard Auth client which might pick up ADC or configured env vars.
        // Ideally we use the user's access token from NextAuth session to write to THEIR Drive/Sheet or SHARED one.
        // But setting up User OAuth for offline access to Drive/Sheet is complex.
        // Simpler approach: Use Service Account for writing, and just record the "Reporter" name in the sheet.

        // Changing approach: Use JWT with Service Account credentials from env for reliability.
        // Need GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in env (not setup yet in env.local).
        // Or just use the User's access token if we can get it? We saved it in session.
        // Let's try to get token from header (passed from frontend).

        const token = req.headers.get("Authorization")?.replace("Bearer ", "");

        let drive, sheets;

        if (token) {
            const oAuth2Client = new google.auth.OAuth2();
            oAuth2Client.setCredentials({ access_token: token });
            drive = google.drive({ version: 'v3', auth: oAuth2Client });
            sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
        } else {
            // Fallback to Service Account if configured (for now error if no token)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Upload Audio
        const buffer = Buffer.from(await audioFile.arrayBuffer());
        const stream = Readable.from(buffer);

        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        const audioFileRes = await drive.files.create({
            requestBody: {
                name: `${date}_${client_name || 'NoClient'}_${assignee}.webm`,
                parents: folderId ? [folderId] : [],
            },
            media: {
                mimeType: 'audio/webm',
                body: stream,
            },
        });

        // 2. Upload Transcript
        const transcriptRes = await drive.files.create({
            requestBody: {
                name: `${date}_${client_name || 'NoClient'}_${assignee}_TRANSCRIPT.txt`,
                parents: folderId ? [folderId] : [],
            },
            media: {
                mimeType: 'text/plain',
                body: full_transcript,
            },
        });

        // 3. Append to Sheets
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (sheetId) {
            await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: 'タスク!A:F', // Added one more column for client_name
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [
                        [date, client_name, task_detail, assignee, reporter, audioFileRes.data.webViewLink]
                    ]
                }
            });
        }

        return NextResponse.json({ success: true, fileId: audioFileRes.data.id });

    } catch (error) {
        console.error("Save API Error:", error);
        return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
    }
}
