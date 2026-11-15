"use client";

import Avatar from "boring-avatars";
import { TINYCLOUD_AVATAR_COLORS, TINYCLOUD_AVATAR_VARIANT } from "@/lib/avatar";

type Props = {
  // Semilla estable del avatar: el username, que es público y no expone el email.
  seed: string;
  size?: number;
};

// Mismo avatar del header (boring-avatars beam + paleta TinyCloud), reutilizable en grande.
export function UserAvatar({ seed, size = 32 }: Props) {
  return (
    <Avatar
      name={seed || "user"}
      variant={TINYCLOUD_AVATAR_VARIANT}
      square
      size={size}
      colors={[...TINYCLOUD_AVATAR_COLORS]}
    />
  );
}
