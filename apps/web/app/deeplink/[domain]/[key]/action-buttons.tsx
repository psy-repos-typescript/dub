"use client";

import { EdgeLinkProps } from "@/lib/planetscale";
import { Button, IOSAppStore, useCopyToClipboard } from "@dub/ui";

export function DeepLinkActionButtons({ link }: { link: EdgeLinkProps }) {
  const [_copied, copyToClipboard] = useCopyToClipboard();

  return (
    <div className="flex flex-col items-center gap-4">
      <a href={link.shortLink} target="_blank" className="w-full">
        <Button
          text="Open in the app"
          className="h-12 w-full rounded-xl bg-neutral-900 text-white"
          variant="primary"
          onClick={() => copyToClipboard(link.shortLink)}
          icon={<IOSAppStore className="size-6" />}
        />
      </a>

      <a
        href={link.shortLink}
        target="_blank"
        className="text-sm text-neutral-500"
      >
        Open in the app without copying
      </a>
    </div>
  );
}
