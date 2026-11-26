export default function Booklet({ url, title }: { url: string; title: string }) {
  return <iframe src={url} title={title} loading="lazy"
    style={{ flex: 2, minWidth: 0, height: 640, border: "1px solid #DCE7F6", borderRadius: 12 }} />;
}
