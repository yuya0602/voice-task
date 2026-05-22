'use client'
import { useState, useRef } from 'react'
import { Mic, Square, Loader2, Save, Edit2 } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface AudioRecorderProps {
    userEmail?: string | null
    userName?: string | null
}

interface TaskData {
    response_date: string
    client_name_kanji: string
    client_name_kana: string
    subject: string
    content: string
}

export default function AudioRecorder({ userEmail, userName }: AudioRecorderProps) {
    const { data: session } = useSession()
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [reviewData, setReviewData] = useState<TaskData | null>(null)
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            mediaRecorderRef.current = new MediaRecorder(stream)
            chunksRef.current = []

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            mediaRecorderRef.current.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                setAudioBlob(blob)
                handleProcessing(blob)
            }

            mediaRecorderRef.current.start()
            setIsRecording(true)
        } catch (err) {
            console.error("Error accessing microphone:", err)
            alert("Microphone access denied. Please allow microphone access to use this app.")
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            if (mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
            }
        }
    }

    const handleProcessing = async (blob: Blob) => {
        setIsProcessing(true)

        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')

        try {
            const response = await fetch('/api/analyze', { method: 'POST', body: formData })
            const data = await response.json()

            if (data.error) throw new Error(data.error)

            setReviewData({
                response_date: data.response_date || '',
                client_name_kanji: data.client_name_kanji || '',
                client_name_kana: data.client_name_kana || '',
                subject: data.subject || '',
                content: data.content || ''
            })
        } catch (error) {
            console.error("Error processing audio:", error)
            alert("Failed to analyze audio. Please check Gemini API Key.")
        } finally {
            setIsProcessing(false)
        }
    }

    const handleSave = async () => {
        if (!reviewData || !audioBlob) return
        setIsSaving(true)

        const formData = new FormData()
        formData.append('audio', audioBlob, 'recording.webm')
        formData.append('taskData', JSON.stringify(reviewData))

        const headers: HeadersInit = {}
        // @ts-ignore
        if (session?.accessToken) {
            // @ts-ignore
            headers['Authorization'] = `Bearer ${session.accessToken}`
        }

        try {
            const res = await fetch('/api/save', {
                method: 'POST',
                body: formData,
                headers: headers
            })

            const result = await res.json().catch(() => ({}))
            if (!res.ok || result.error) {
                throw new Error(result.error || `Save failed (HTTP ${res.status})`)
            }

            alert("Task saved successfully!")
            setReviewData(null)
            setAudioBlob(null)
        } catch (e: any) {
            console.error(e)
            alert(`保存に失敗しました:\n${e?.message || e}`)
        } finally {
            setIsSaving(false)
        }
    }

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording()
        } else {
            startRecording()
        }
    }

    if (reviewData) {
        return (
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-8 text-gray-800">
                <h2 className="text-2xl font-bold mb-6 text-indigo-600 flex items-center gap-2">
                    <Edit2 /> 内容を確認
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">対応日</label>
                        <input
                            type="text"
                            value={reviewData.response_date}
                            onChange={e => setReviewData({ ...reviewData, response_date: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50 p-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">顧客名（漢字）</label>
                        <input
                            type="text"
                            value={reviewData.client_name_kanji}
                            onChange={e => setReviewData({ ...reviewData, client_name_kanji: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50 p-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">顧客名（カナ・半角）</label>
                        <input
                            type="text"
                            value={reviewData.client_name_kana}
                            onChange={e => setReviewData({ ...reviewData, client_name_kana: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50 p-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">担当者</label>
                        <input
                            type="text"
                            value="竹田健介"
                            disabled
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-500 p-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">件名</label>
                        <input
                            type="text"
                            value={reviewData.subject}
                            onChange={e => setReviewData({ ...reviewData, subject: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50 p-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">内容（文字起こし）</label>
                        <textarea
                            value={reviewData.content}
                            rows={6}
                            onChange={e => setReviewData({ ...reviewData, content: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50 p-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">対応手段</label>
                        <input
                            type="text"
                            value="電話"
                            disabled
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-500 p-2"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-8">
                    <button
                        onClick={() => { setReviewData(null); setAudioBlob(null); }}
                        className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold shadow-lg flex items-center gap-2"
                    >
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                        Confirm & Save
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
            <div className="mb-8 text-center text-white">
                <h2 className="text-2xl font-bold">Hello, {userName || 'User'}</h2>
                <p className="opacity-80">Ready to record new task</p>
            </div>

            <button
                disabled={isProcessing}
                className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${isProcessing ? 'bg-gray-600 cursor-not-allowed' :
                    isRecording
                        ? 'bg-red-500 scale-110 animate-pulse'
                        : 'bg-indigo-500 hover:bg-indigo-400'
                    }`}
                onClick={toggleRecording}
            >
                {isProcessing ? (
                    <Loader2 className="w-16 h-16 text-white animate-spin" />
                ) : isRecording ? (
                    <Square className="w-16 h-16 text-white fill-current" />
                ) : (
                    <Mic className="w-16 h-16 text-white" />
                )}
            </button>

            <p className="mt-8 text-xl text-white font-medium">
                {isProcessing ? 'Processing with Gemini...' :
                    isRecording ? 'Listening...' : 'Tap to Record'}
            </p>
        </div>
    )
}
