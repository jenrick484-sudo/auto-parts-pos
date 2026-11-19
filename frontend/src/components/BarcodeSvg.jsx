import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function BarcodeSvg({ value, width = 1.4, height = 28, fontSize = 10 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, String(value).toUpperCase(), {
          format: 'CODE128',
          width,
          height,
          fontSize,
          margin: 2,
          displayValue: true,
        });
      } catch (err) {
        console.error('Barcode render error:', err);
      }
    }
  }, [value, width, height, fontSize]);

  return <svg ref={svgRef} className="max-w-full mx-auto block" />;
}
