import { getServerSession } from "next-auth"
import { authOptions } from "./api/auth/[...nextauth]/route"
import AudioRecorder from "@/components/AudioRecorder"
import LoginView from "@/components/LoginView"

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return <LoginView />
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4">
      <AudioRecorder userEmail={session.user?.email} userName={session.user?.name} />
    </main>
  )
}
