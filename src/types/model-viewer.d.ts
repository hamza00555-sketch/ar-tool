import type React from "react";

/** Minimal typing for the <model-viewer> web component (what we use of it). */
export interface ModelViewerElement extends HTMLElement {
  canActivateAR: boolean;
  activateAR(): Promise<void>;
}

type ModelViewerAttributes = React.DetailedHTMLProps<
  React.HTMLAttributes<ModelViewerElement>,
  ModelViewerElement
> & {
  src?: string;
  "ios-src"?: string;
  alt?: string;
  ar?: boolean;
  "ar-modes"?: string;
  "ar-scale"?: string;
  "camera-controls"?: boolean;
  "auto-rotate"?: boolean;
  "shadow-intensity"?: string;
  "environment-image"?: string;
  exposure?: string;
  loading?: string;
  reveal?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}
