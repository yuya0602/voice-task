'use client'
import { signIn } from "next-auth/react"

export default function LoginView() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-indigo-500 to-purple-600">
            <h1 className="text-4xl font-bold text-white mb-8">VoiceTask</h1>
            <button
                onClick={() => signIn('google')}
                className="px-8 py-4 bg-white text-indigo-600 rounded-full font-bold text-xl shadow-lg hover:bg-gray-100 transition-transform transform hover:scale-105"
            >
                Sign in with Google
            </button>
        </div>
    )
}
