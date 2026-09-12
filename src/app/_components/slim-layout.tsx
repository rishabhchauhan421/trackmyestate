import Image from "next/image";

/** Split-screen auth-page shell: a narrow form panel plus a full-bleed decorative image. */
export function SlimLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen shrink-0 justify-center md:px-12 lg:px-0">
      <div className="relative z-10 flex flex-1 flex-col bg-white px-4 py-10 shadow-2xl sm:justify-center md:flex-none md:px-28 dark:bg-slate-950">
        <main className="mx-auto w-full max-w-md sm:px-4 md:w-96 md:max-w-sm md:px-0">
          {children}
        </main>
      </div>
      <div className="hidden sm:contents lg:relative lg:block lg:flex-1">
        <Image
          className="object-cover"
          src="/images/background-auth.jpg"
          alt=""
          fill
          sizes="50vw"
        />
      </div>
    </div>
  );
}
