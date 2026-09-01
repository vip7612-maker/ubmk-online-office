import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/actions";
import { getViewer } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Auth.js가 ?error= 로 넘겨주는 코드를 사람 말로 바꾼다. */
function errorMessage(code?: string): string | null {
  if (!code) return null;
  if (code === "AccessDenied") {
    return "이 계정으로는 들어올 수 없습니다. ubmk.net 계정으로 로그인하거나, 관리자에게 사용 승인을 요청하세요.";
  }
  if (code === "Configuration") {
    return "로그인 설정에 문제가 있습니다. 관리자에게 알려주세요.";
  }
  return "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getViewer()) redirect("/");

  const { error } = await props.searchParams;
  const message = errorMessage(error);

  return (
    <div className="grid min-h-full place-items-center bg-ink-900 px-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-xl font-bold text-white shadow-lg">
            U
          </span>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-white">
            UBMK 온라인교무실
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-400">
            학교 구글 계정(@ubmk.net)으로 로그인하세요.
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] leading-relaxed text-red-200">
            {message}
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink-200 bg-white px-4 py-3 text-[14.5px] font-semibold text-ink-800 transition-colors hover:bg-ink-50"
            >
              <GoogleMark />
              Google 계정으로 로그인
            </button>
          </form>
          <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-400">
            승인된 교직원만 이용할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
