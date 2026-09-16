export type CreativeCopy = {
    headline: string;
    subheadline?: string;
    cta?: string;
  };
  
  export async function createCreativeImage(
    imageSrc: string,
    copy: CreativeCopy
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const image = new Image();
  
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
  
          const width = 1080;
          const height = 1080;
  
          canvas.width = width;
          canvas.height = height;
  
          const ctx = canvas.getContext("2d");
  
          if (!ctx) {
            reject(
              new Error("Unable to create canvas context.")
            );
            return;
          }
  
          /*
           * ============================================
           * BACKGROUND IMAGE
           * ============================================
           */
  
          const imageRatio =
            image.width / image.height;
  
          const canvasRatio =
            width / height;
  
          let drawWidth = width;
          let drawHeight = height;
          let offsetX = 0;
          let offsetY = 0;
  
          if (imageRatio > canvasRatio) {
            drawHeight = height;
            drawWidth =
              height * imageRatio;
            offsetX =
              (width - drawWidth) / 2;
          } else {
            drawWidth = width;
            drawHeight =
              width / imageRatio;
            offsetY =
              (height - drawHeight) / 2;
          }
  
          ctx.drawImage(
            image,
            offsetX,
            offsetY,
            drawWidth,
            drawHeight
          );
  
          /*
           * ============================================
           * DARK GRADIENT
           * Helps typography remain readable.
           * ============================================
           */
  
          const gradient =
            ctx.createLinearGradient(
              0,
              0,
              0,
              height
            );
  
          gradient.addColorStop(
            0,
            "rgba(0,0,0,0.05)"
          );
  
          gradient.addColorStop(
            0.45,
            "rgba(0,0,0,0.05)"
          );
  
          gradient.addColorStop(
            0.72,
            "rgba(0,0,0,0.35)"
          );
  
          gradient.addColorStop(
            1,
            "rgba(0,0,0,0.82)"
          );
  
          ctx.fillStyle = gradient;
  
          ctx.fillRect(
            0,
            0,
            width,
            height
          );
  
          /*
           * ============================================
           * POSTOLL BRAND BADGE
           * ============================================
           */
  
          const badgeX = 70;
          const badgeY = 65;
          const badgeWidth = 155;
          const badgeHeight = 48;
  
          ctx.beginPath();
  
          ctx.roundRect(
            badgeX,
            badgeY,
            badgeWidth,
            badgeHeight,
            24
          );
  
          ctx.fillStyle =
            "rgba(0,0,0,0.45)";
  
          ctx.fill();
  
          ctx.strokeStyle =
            "rgba(255,255,255,0.35)";
  
          ctx.lineWidth = 1;
  
          ctx.stroke();
  
          ctx.fillStyle = "#ffffff";
  
          ctx.font =
            "700 20px Arial, sans-serif";
  
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
  
          ctx.fillText(
            "POSTOLL",
            badgeX + badgeWidth / 2,
            badgeY + badgeHeight / 2
          );
  
          /*
           * ============================================
           * HEADLINE
           * ============================================
           */
  
          const headline =
            copy.headline.trim();
  
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
  
          ctx.fillStyle = "#ffffff";
  
          const headlineMaxWidth = 900;
  
          const headlineFontSize =
            headline.length > 30
              ? 68
              : 82;
  
          ctx.font =
            `800 ${headlineFontSize}px Arial, sans-serif`;
  
          const headlineLines =
            wrapText(
              ctx,
              headline,
              headlineMaxWidth
            );
  
          let headlineY = 675;
  
          for (const line of headlineLines) {
            ctx.fillText(
              line,
              70,
              headlineY
            );
  
            headlineY +=
              headlineFontSize * 1.05;
          }
  
          /*
           * ============================================
           * SUBHEADLINE
           * ============================================
           */
  
          if (
            copy.subheadline &&
            copy.subheadline.trim()
          ) {
            const subheadline =
              copy.subheadline.trim();
  
            ctx.font =
              "400 30px Arial, sans-serif";
  
            ctx.fillStyle =
              "rgba(255,255,255,0.92)";
  
            const subLines =
              wrapText(
                ctx,
                subheadline,
                780
              );
  
            let subY =
              headlineY + 18;
  
            for (const line of subLines) {
              ctx.fillText(
                line,
                70,
                subY
              );
  
              subY += 40;
            }
          }
  
          /*
           * ============================================
           * CTA
           * ============================================
           */
  
          if (
            copy.cta &&
            copy.cta.trim()
          ) {
            const cta =
              copy.cta.trim();
  
            const buttonX = 70;
            const buttonY = 910;
            const buttonWidth = 230;
            const buttonHeight = 64;
  
            ctx.beginPath();
  
            ctx.roundRect(
              buttonX,
              buttonY,
              buttonWidth,
              buttonHeight,
              32
            );
  
            ctx.fillStyle =
              "#ffffff";
  
            ctx.fill();
  
            ctx.fillStyle =
              "#111111";
  
            ctx.font =
              "700 22px Arial, sans-serif";
  
            ctx.textAlign =
              "center";
  
            ctx.textBaseline =
              "middle";
  
            ctx.fillText(
              cta,
              buttonX +
                buttonWidth / 2,
              buttonY +
                buttonHeight / 2
            );
          }
  
          /*
           * ============================================
           * SMALL FOOTER
           * ============================================
           */
  
          ctx.textAlign = "right";
  
          ctx.textBaseline = "bottom";
  
          ctx.font =
            "600 16px Arial, sans-serif";
  
          ctx.fillStyle =
            "rgba(255,255,255,0.75)";
  
          ctx.fillText(
            "CREATE • SHARE • INSPIRE",
            1010,
            1015
          );
  
          /*
           * ============================================
           * EXPORT
           * ============================================
           */
  
          const finalImage =
            canvas.toDataURL(
              "image/png",
              1
            );
  
          resolve(finalImage);
        } catch (error) {
          reject(error);
        }
      };
  
      image.onerror = () => {
        reject(
          new Error(
            "Unable to load generated image."
          )
        );
      };
  
      image.src = imageSrc;
    });
  }
  
  
  /*
   * ================================================
   * TEXT WRAPPING
   * ================================================
   */
  
  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] {
    const words =
      text.split(/\s+/);
  
    const lines: string[] = [];
  
    let currentLine = "";
  
    for (const word of words) {
      const testLine =
        currentLine
          ? `${currentLine} ${word}`
          : word;
  
      const metrics =
        ctx.measureText(testLine);
  
      if (
        metrics.width <= maxWidth
      ) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
  
        currentLine = word;
      }
    }
  
    if (currentLine) {
      lines.push(currentLine);
    }
  
    return lines;
  }