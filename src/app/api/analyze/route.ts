import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get("audio") as Blob;

        if (!audioFile) {
            return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
        }

        const arrayBuffer = await audioFile.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString("base64");

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        // Using 'gemini-flash-latest' (1.5 Flash) which is confirmed in your available models list
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const today = new Date().toISOString().split('T')[0];

        const prompt = `
      システムプロンプト: あなたは優秀な社内秘書AIです。提供された音声ファイルを解析し、以下のJSONフォーマットで情報を抽出してください。

      抽出項目:
      date: タスクの期限や実施日（「来週の月曜」などは具体的な日付 YYYY/MM/DD に変換すること。今日の日付：${today}）
      task_detail: 何をする必要があるか（簡潔かつ具体的に）
      assignee: 誰が担当するか（音声内で言及がない場合は「未指定」）
      client_name: どの顧客との話か（全てカタカナで記載すること）
      full_transcript: 音声の全文書き起こし

      制約事項:
      余計な解説は含めず、JSONデータのみを出力してください。
      音声が不明瞭で判断できない項目は null としてください。
      日本語で出力してください。
    `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: audioFile.type || "audio/webm",
                    data: base64Audio
                }
            }
        ]);

        const text = result.response.text();
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanText);

        return NextResponse.json(data);

    } catch (error) {
        console.error("Gemini API Error:", error);
        return NextResponse.json({ error: "Failed to process audio" }, { status: 500 });
    }
}
