
import React, { useEffect, useState } from "react";
// @ts-ignore
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// --- Icons (Refined Stroke & Size) ---
// Now accepting SVGProps to allow custom classes (colors, sizes)
export const Icons = {
  Back: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
      className={`w-6 h-6 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5L8.25 12l7.5-7.5"
      />
    </svg>
  ),
  Send: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
      className={`w-5 h-5 ${props.className || ""}`}
    >
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  ),
  Plus: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      {...props}
      className={`w-6 h-6 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.5v15m7.5-7.5h-15"
      />
    </svg>
  ),
  Settings: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      {...props}
      className={`w-6 h-6 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.212 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
  Chat: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      {...props}
      className={`w-6 h-6 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H21m-4.5 0c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    </svg>
  ),
  Search: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
      className={`w-5 h-5 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  ),
  Close: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
      className={`w-6 h-6 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  ),
  Check: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      {...props}
      className={`w-4 h-4 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  ),
  DoubleCheck: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      {...props}
      className={`w-4 h-4 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 6l-7.5 7.5 2.5 2.5m5-10l-7.5 7.5L6 10.5"
      />
    </svg>
  ),
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
      className={`w-5 h-5 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
      />
    </svg>
  ),
  Trash: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
      className={`w-5 h-5 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  ),
  Edit: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
      className={`w-5 h-5 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
      />
    </svg>
  ),
  Info: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
      className={`w-6 h-6 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    </svg>
  ),
  Lock: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      {...props}
      className={`w-3 h-3 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  ),
  Fingerprint: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
      className={`w-6 h-6 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.875 14.25l1.214 1.942a2.25 2.25 0 001.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.41 9a15.356 15.356 0 0111.126-5.026h.966A15.356 15.356 0 0121.59 9m-1.157 5.614A8.068 8.068 0 0117.98 18c-.772.431-1.4.916-1.896 1.357-.49.434-1.01.76-1.584.975-1.118.423-2.392.423-3.51 0-.574-.216-1.094-.541-1.584-.975C8.916 18.916 8.288 18.431 7.516 18a8.068 8.068 0 01-2.454-3.386m13.88-5.632a7.958 7.958 0 010 2.255m-14.366 0a7.958 7.958 0 010-2.255m1.522 3.636a7.952 7.952 0 01-1.87 2.18m11.45-6.526a7.952 7.952 0 011.87 2.18m-13.32-6.526a12.009 12.009 0 013.929-2.752m7.462 0a12.009 12.009 0 013.93 2.752"
      />
    </svg>
  ),
  PaperClip: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
      className={`w-5 h-5 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
      />
    </svg>
  ),
  Reply: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
      className={`w-5 h-5 ${props.className || ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
      />
    </svg>
  ),
  ZoomIn: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props} className={`w-6 h-6 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
    </svg>
  ),
  ZoomOut: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props} className={`w-6 h-6 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM7.5 10.5h6" />
    </svg>
  ),
  Reset: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props} className={`w-6 h-6 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  Camera: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props} className={`w-6 h-6 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  ),
  Mic: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props} className={`w-5 h-5 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  ),
  Play: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="currentColor" viewBox="0 0 24 24" {...props} className={`w-5 h-5 ${props.className || ""}`}>
      <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
    </svg>
  ),
  Pause: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="currentColor" viewBox="0 0 24 24" {...props} className={`w-5 h-5 ${props.className || ""}`}>
      <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
    </svg>
  ),
  Phone: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props} className={`w-6 h-6 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  ),
  Video: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props} className={`w-6 h-6 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  MicOff: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props} className={`w-6 h-6 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 23.036l-1.528-1.528m-5.262-5.262l-8.832-8.832m9.192 9.192l-3.32-3.32m3.32 3.32v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  VideoOff: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props} className={`w-6 h-6 ${props.className || ""}`}>
       <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ),
  ArrowUpRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props} className={`w-4 h-4 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
    </svg>
  ),
  ArrowDownLeft: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props} className={`w-4 h-4 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" />
    </svg>
  ),
  PhoneMissed: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props} className={`w-4 h-4 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" />
    </svg>
  ),
  Walkie: (props: React.SVGProps<SVGSVGElement>) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props} className={`w-6 h-6 ${props.className || ""}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  )
};

// --- Avatar Component ---
export const Avatar: React.FC<{
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  online?: boolean; // undefined = hide status, true = online, false = offline
  blocked?: boolean; // true = blocked (overrides online status)
  className?: string;
  showStatus?: boolean; // Toggles whether to show any status dot at all
}> = ({ name, src, size = "md", online, blocked, className, showStatus = true }) => {
  const sizeClasses = {
    sm: "w-9 h-9 text-xs",
    md: "w-12 h-12 text-base",
    lg: "w-16 h-16 text-xl",
    xl: "w-24 h-24 text-3xl",
    "2xl": "w-32 h-32 text-4xl"
  };

  // Modern gradients
  const gradients = [
    "from-blue-500 to-indigo-600",
    "from-emerald-400 to-cyan-500",
    "from-orange-400 to-rose-500",
    "from-violet-500 to-purple-600",
    "from-pink-500 to-rose-500",
  ];

  const hash = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradient = gradients[hash % gradients.length];
  
  // Status Dot Logic
  // Priority: Blocked > Online > Offline
  let statusColor = "";
  let shouldShowDot = false;

  if (showStatus && (online !== undefined || blocked)) {
      shouldShowDot = true;
      if (blocked) {
          statusColor = "bg-black border-white/20"; // Black dot for blocked
      } else if (online) {
          statusColor = "bg-green-500 border-surface"; // Green dot for online
      } else {
          statusColor = "bg-white border-surface"; // White dot for offline
      }
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${gradient} p-[2px] shadow-sm overflow-hidden`}
      >
        {src ? (
             <img src={src} alt={name} className="w-full h-full rounded-full object-cover border border-white/10" />
        ) : (
            <div className="w-full h-full rounded-full bg-surface/10 backdrop-blur-sm flex items-center justify-center font-bold text-white border border-white/20">
            {name.charAt(0).toUpperCase()}
            </div>
        )}
      </div>
      
      {shouldShowDot && (
        <div
          className={`
            absolute bottom-0 right-0 rounded-full border-2
            ${statusColor}
            ${size === "xl" || size === "2xl" ? "w-6 h-6 border-4" : size === "lg" ? "w-4 h-4" : "w-3 h-3"}
          `}
        />
      )}
    </div>
  );
};

// --- Top Bar (Glass) ---
export const TopBar: React.FC<{
  title: React.ReactNode;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
  transparent?: boolean;
  onClickTitle?: () => void;
}> = ({
  title,
  onBack,
  actions,
  className,
  transparent = false,
  onClickTitle,
}) => (
  <div
    className={`
    sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-all duration-300
    ${transparent ? "bg-transparent" : "glass-panel border-b border-white/5"}
    ${className}
  `}
  >
    <div className="h-14 flex items-center w-full px-4 gap-2">
      {onBack && (
        <button
          onClick={onBack}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-text-main hover:bg-surface-highlight/50 tap-active transition-colors"
        >
          <Icons.Back className="w-5 h-5" />
        </button>
      )}
      <div
        className={`flex-1 min-w-0 flex flex-col justify-center ${onClickTitle ? "cursor-pointer" : ""}`}
        onClick={onClickTitle}
      >
        {typeof title === "string" ? (
          <h1 className="text-base font-bold text-text-main truncate tracking-tight">
            {title}
          </h1>
        ) : (
          title
        )}
      </div>
      {actions && <div className="flex items-center gap-1.5">{actions}</div>}
    </div>
  </div>
);

// --- FAB ---
export const FAB: React.FC<{ onClick: () => void; icon?: React.ReactNode }> = ({
  onClick,
  icon,
}) => (
  <button
    onClick={onClick}
    className="fixed w-14 h-14 bg-gradient-to-br from-primary to-primary/80 text-primary-fg rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center tap-active z-30 transition-transform duration-300 hover:scale-110 active:scale-95"
    style={{
      bottom: "calc(6rem + env(safe-area-inset-bottom))",
      right: "1.5rem",
    }}
  >
    {icon || <Icons.Plus className="w-6 h-6" />}
  </button>
);

// --- Scroll Down FAB ---
export const ScrollDownFab: React.FC<{
  onClick: () => void;
  visible: boolean;
  unreadCount?: number;
}> = ({ onClick, visible, unreadCount = 0 }) => (
  <button
    onClick={onClick}
    className={`
      fixed w-10 h-10 bg-surface/90 backdrop-blur text-primary border border-white/10 rounded-full shadow-lg flex items-center justify-center tap-active z-30 transition-all duration-300
      ${visible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"}
    `}
    style={{
      bottom: "calc(6rem + env(safe-area-inset-bottom))",
      right: "1.5rem",
    }}
  >
    <Icons.ChevronDown className="w-5 h-5" />
    {unreadCount > 0 && (
      <div className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm animate-scale-in border border-surface">
        {unreadCount > 99 ? '99+' : unreadCount}
      </div>
    )}
  </button>
);

// --- Bottom Navigation (Glass) ---
export const BottomNav: React.FC<{
  activeTab: "chats" | "settings" | "calls";
  onTabChange: (t: "chats" | "settings" | "calls") => void;
}> = ({ activeTab, onTabChange }) => (
  <div className="fixed bottom-0 left-0 w-full glass-nav border-t border-white/5 z-40 pb-[env(safe-area-inset-bottom)] shadow-nav">
    <div className="h-16 flex items-center justify-around px-6">
      <button
        onClick={() => onTabChange("chats")}
        className={`flex flex-col items-center justify-center gap-1 w-20 py-2 rounded-2xl transition-all ${activeTab === "chats" ? "text-primary" : "text-text-sub opacity-60"}`}
      >
        <div
          className={`p-1.5 rounded-xl transition-all ${activeTab === "chats" ? "bg-primary/10 scale-105" : ""}`}
        >
          <Icons.Chat className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-bold">Chats</span>
      </button>

      <button
        onClick={() => onTabChange("calls")}
        className={`flex flex-col items-center justify-center gap-1 w-20 py-2 rounded-2xl transition-all ${activeTab === "calls" ? "text-primary" : "text-text-sub opacity-60"}`}
      >
        <div
          className={`p-1.5 rounded-xl transition-all ${activeTab === "calls" ? "bg-primary/10 scale-105" : ""}`}
        >
          <Icons.Phone className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-bold">Calls</span>
      </button>

      <button
        onClick={() => onTabChange("settings")}
        className={`flex flex-col items-center justify-center gap-1 w-20 py-2 rounded-2xl transition-all ${activeTab === "settings" ? "text-primary" : "text-text-sub opacity-60"}`}
      >
        <div
          className={`p-1.5 rounded-xl transition-all ${activeTab === "settings" ? "bg-primary/10 scale-105" : ""}`}
        >
          <Icons.Settings className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-bold">Settings</span>
      </button>
    </div>
  </div>
);

// --- Input Field (Modern) ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (
  props,
) => (
  <div className="relative w-full group">
    <input
      {...props}
      className={`w-full bg-surface text-text-main border border-white/10 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-primary/50 focus:border-primary focus:outline-none transition-all placeholder:text-text-sub/50 text-sm font-medium ${props.className}`}
    />
  </div>
);

// --- Button (Modern) ---
export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "danger" | "ghost";
  }
> = ({ variant = "primary", className, ...props }) => {
  let baseClass =
    "w-full py-3.5 rounded-2xl font-bold tracking-wide transition-all tap-active disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-base";
  let colorClass = "";

  switch (variant) {
    case "primary":
      colorClass =
        "bg-gradient-to-r from-primary to-primary/90 text-primary-fg shadow-lg shadow-primary/30 hover:shadow-primary/40";
      break;
    case "secondary":
      colorClass =
        "bg-surface text-text-main border border-white/10 hover:bg-surface-highlight";
      break;
    case "danger":
      colorClass =
        "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20";
      break;
    case "ghost":
      colorClass =
        "bg-transparent text-text-sub hover:text-text-main hover:bg-surface-highlight/30";
      break;
  }

  return (
    <button {...props} className={`${baseClass} ${colorClass} ${className}`} />
  );
};

// --- Bottom Sheet ---
export const BottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ isOpen, onClose, children }) => {
  const [render, setRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setRender(true);
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) setRender(false);
  };

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto ${isOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`
            bg-surface w-full max-w-2xl rounded-t-[40px] p-8 shadow-2xl border-t border-white/10 transform transition-transform duration-300 pointer-events-auto
            flex flex-col max-h-[85vh]
            ${isOpen ? "translate-y-0" : "translate-y-full"}
        `}
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        onTransitionEnd={handleAnimationEnd}
      >
        <div className="w-12 h-1 bg-surface-highlight rounded-full mx-auto mb-6 opacity-40 flex-shrink-0" />
        <div className="overflow-y-auto no-scrollbar">
            {children}
        </div>
      </div>
    </div>
  );
};

// --- Alert Modal ---
export const AlertModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
}> = ({
  isOpen,
  onClose,
  title,
  message,
  buttonText = "OK",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-surface w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-white/10 animate-scale-in">
        <h3 className="text-lg font-bold text-text-main mb-2 text-center">
          {title}
        </h3>
        <p className="text-text-sub text-center mb-6 text-sm leading-relaxed opacity-80">
          {message}
        </p>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all tap-active bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/30 hover:shadow-primary/40"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

// --- Confirmation Modal ---
export const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-surface w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-white/10 animate-scale-in max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-text-main mb-2 text-center">
          {title}
        </h3>
        <p className="text-text-sub text-center mb-6 text-sm leading-relaxed opacity-80">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-text-main bg-surface-highlight hover:bg-surface-highlight/80 text-sm transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all tap-active ${isDestructive ? "bg-gradient-to-r from-danger to-danger/80 shadow-lg shadow-danger/30 hover:shadow-danger/40" : "bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/30 hover:shadow-primary/40"}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Image Viewer Modal ---
export const ImageViewer: React.FC<{
  isOpen: boolean;
  src: string;
  onClose: () => void;
}> = ({ isOpen, src, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-lg flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-[calc(1.5rem+env(safe-area-inset-top))] right-6 p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors z-[160]"
      >
        <Icons.Close className="w-5 h-5" />
      </button>

      <div onClick={(e) => e.stopPropagation()} className="w-full h-full flex flex-col justify-center">
        <TransformWrapper
          initialScale={1}
          minScale={1}
          maxScale={5}
          centerOnInit={true}
          alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[160] flex gap-4 bg-black/50 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
                <button onClick={() => zoomOut()} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                    <Icons.ZoomOut className="w-6 h-6" />
                </button>
                <button onClick={() => resetTransform()} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                    <Icons.Reset className="w-6 h-6" />
                </button>
                <button onClick={() => zoomIn()} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                    <Icons.ZoomIn className="w-6 h-6" />
                </button>
              </div>

              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="!w-full !h-full flex items-center justify-center"
              >
                <img
                  src={src}
                  alt="Full view"
                  className="max-w-full max-h-screen object-contain animate-scale-in"
                />
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
};
