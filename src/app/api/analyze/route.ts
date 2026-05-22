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
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const now = new Date();
        const responseDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

        const prompt = `
      システムプロンプト: あなたは優秀な社内秘書AIです。提供された音声ファイルを解析し、以下のJSONフォーマットで情報を抽出してください。

      抽出項目:
      client_name_kanji: 顧客名（漢字表記。姓と名の間に半角スペースを入れる。例：「中川 紫乃」）
      client_name_kana: 顧客名（半角カタカナ表記。姓と名の間に半角スペースを入れる。例：「ﾅｶｶﾞﾜ ｼﾉ」）
      subject: 件名（内容を簡潔に要約した短いタイトル。例：「自動車保険内容確認」）
      content: 内容（音声の文字起こしをそのまま記入。整形や要約はしない）

      制約事項:
      余計な解説は含めず、JSONデータのみを出力してください。
      音声が不明瞭で判断できない項目は null としてください。
      client_name_kana は必ず半角カタカナ（ｱｲｳｴｵ...）で出力してください。全角カタカナは使わないこと。
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

        return NextResponse.json({
            response_date: responseDate,
            client_name_kanji: data.client_name_kanji || '',
            client_name_kana: data.client_name_kana || '',
            subject: data.subject || '',
            content: data.content || ''
        });

    } catch (error) {
        console.error("Gemini API Error:", error);
        return NextResponse.json({ error: "Failed to process audio" }, { status: 500 });
    }
}
