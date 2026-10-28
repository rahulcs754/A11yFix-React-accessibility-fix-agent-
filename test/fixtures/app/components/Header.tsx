import Image from "next/image";
import { MenuIcon, XIcon } from "./icons";

export function Header({ open, onToggle, user }: { open: boolean; onToggle: () => void; user: { avatar: string } }) {
  return (
    <header>
      <Image src="/logo.svg" width={120} height={32} />
      <img src={user.avatar} className="rounded-full" />
      <img src="/divider.png" alt="" />
      <button onClick={onToggle}>{open ? <XIcon /> : <MenuIcon />}</button>
      <button onClick={onToggle}>Menu</button>
      <div className="card" onClick={onToggle}>Open settings</div>
      <span role="button" tabIndex={0} onClick={onToggle} onKeyDown={onToggle}>OK</span>
      <a onClick={onToggle}>Sign out</a>
      <a href="/home">Home</a>
      <div tabIndex={3}>Skip</div>
    </header>
  );
}
