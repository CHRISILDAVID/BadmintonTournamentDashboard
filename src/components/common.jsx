import React, { useEffect, useRef } from "react";
import { Trophy, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog.jsx";
import { Badge } from "./ui/badge.jsx";
import { Label } from "./ui/label.jsx";
import logo from "../../assets/logo.jpg";

export function Logo({ small = false }) {
  return <div className={`brand ${small ? "small" : ""}`}><img src={logo} alt="ShuttleHub" width="150" height="150" /></div>;
}
export function Pill({ children, tone = "" }) {
  return <Badge variant="secondary" className={`pill ${tone} ${tone === "green" ? "bg-emerald-50 text-emerald-800" : ""}`}>{children}</Badge>;
}
export function Empty({ title, children, action }) {
  return <div className="empty"><Trophy size={32}/><h3>{title}</h3><p>{children}</p>{action}</div>;
}
export function Modal({ title, children, close, wide }) {
  const previous = useRef(document.activeElement);
  useEffect(() => () => previous.current?.focus(), []);
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className={`desk-dialog max-h-[90dvh] overflow-y-auto bg-card ${wide ? "sm:max-w-3xl" : "sm:max-w-xl"}`} onCloseAutoFocus={e => { e.preventDefault(); previous.current?.focus(); }}>
      <DialogHeader className="mb-3 pr-6 text-left">
        <DialogDescription className="text-xs font-semibold tracking-widest text-primary">SHUTTLEHUB TOURNAMENT DESK</DialogDescription>
        <DialogTitle className="text-2xl leading-tight">{title}</DialogTitle>
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>;
}
export function Field({ label, children, hint }) {
  return <Label className="field grid items-start justify-items-start gap-2"><span>{label}</span>{children}{hint && <small>{hint}</small>}</Label>;
}
export const MapPinIcon = () => <MapPin size={15}/>;
