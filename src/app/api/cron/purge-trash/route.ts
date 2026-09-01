import { purgeExpired } from "@/lib/posts";

// 매일 한 번 Vercel Cron 이 부른다 (vercel.json 참고).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Vercel Cron 은 CRON_SECRET 이 설정돼 있으면 Bearer 로 실어 보낸다.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 401 });
  }

  const purged = await purgeExpired();
  console.log(`휴지통 청소: ${purged.length}건 완전 삭제`);
  return Response.json({ purged: purged.length });
}
