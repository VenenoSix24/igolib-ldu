import { useEffect } from "react";

/**
 * 全局注入一次的折射滤镜：
 * feImage 位移贴图（运行时 canvas 生成）→ feGaussianBlur → feDisplacementMap。
 * Chromium 系通过特性检测后给 body 挂 refraction 类，其余引擎保持基础磨砂。
 * 滤镜链结构参考 codepen.io/Mikhail-Bespalov/pen/MYwrMNy
 */
const FILTER_ID = "igolib-frosted";

function makeDisplacementMap(size: number, edgeWidth: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const e = Math.min(Math.min(nx, 1 - nx), Math.min(ny, 1 - ny));
      const t = Math.max(0, 1 - e / edgeWidth);
      const s = t * t * 0.9;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(128 + (0.5 - nx) * s * 127);
      img.data[i + 1] = Math.round(128 + (0.5 - ny) * s * 127);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

export function GlassFilter() {
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.backdropFilter = `url(#${FILTER_ID})`;
    const supported = (getComputedStyle(probe).backdropFilter || "").includes("url");
    if (!supported) return;

    document.body.classList.add("refraction");
    const map = makeDisplacementMap(256, 0.14);
    const feImage = document.getElementById("igolib-frosted-map");
    if (feImage) feImage.setAttribute("href", map);

    // hover 弹性：位移强度放大
    const disp = document.getElementById("igolib-frosted-disp");
    const onEnter = () => disp?.setAttribute("scale", "26");
    const onLeave = () => disp?.setAttribute("scale", "14");
    document.body.addEventListener("pointerover", (e) => {
      if ((e.target as HTMLElement).closest?.(".glass-hoverable")) onEnter();
      else onLeave();
    });
  }, []);

  return (
    <svg aria-hidden="true" style={{ position: "absolute", width: 0, height: 0 }}>
      <filter id={FILTER_ID} primitiveUnits="objectBoundingBox" x="0" y="0" width="1" height="1">
        <feImage id="igolib-frosted-map" x="0" y="0" width="1" height="1" result="map" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.015" result="blur" />
        <feDisplacementMap id="igolib-frosted-disp" in="blur" in2="map" scale="14" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
