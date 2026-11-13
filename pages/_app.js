import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  // 관리자 화면은 전체 글자·간격을 크게 (기본 16px → 18px), 앰버서더 신청 화면은 그대로
  useEffect(() => {
    const isAdmin = router.pathname.startsWith('/admin')
    document.documentElement.style.fontSize = isAdmin ? '18px' : ''
  }, [router.pathname])

  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
