import { useEffect, useRef } from 'react';

const vertexShaderSource = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;
uniform vec2 resolution;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform float colorNum;
uniform float pixelSize;
uniform float seed;

vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - seed;
  return fbm(p + fbm(p2));
}

float bayerValue(float idx) {
  if (idx < 0.5) return 0.0 / 64.0;
  if (idx < 1.5) return 48.0 / 64.0;
  if (idx < 2.5) return 12.0 / 64.0;
  if (idx < 3.5) return 60.0 / 64.0;
  if (idx < 4.5) return 3.0 / 64.0;
  if (idx < 5.5) return 51.0 / 64.0;
  if (idx < 6.5) return 15.0 / 64.0;
  if (idx < 7.5) return 63.0 / 64.0;
  if (idx < 8.5) return 32.0 / 64.0;
  if (idx < 9.5) return 16.0 / 64.0;
  if (idx < 10.5) return 44.0 / 64.0;
  if (idx < 11.5) return 28.0 / 64.0;
  if (idx < 12.5) return 35.0 / 64.0;
  if (idx < 13.5) return 19.0 / 64.0;
  if (idx < 14.5) return 47.0 / 64.0;
  if (idx < 15.5) return 31.0 / 64.0;
  if (idx < 16.5) return 8.0 / 64.0;
  if (idx < 17.5) return 56.0 / 64.0;
  if (idx < 18.5) return 4.0 / 64.0;
  if (idx < 19.5) return 52.0 / 64.0;
  if (idx < 20.5) return 11.0 / 64.0;
  if (idx < 21.5) return 59.0 / 64.0;
  if (idx < 22.5) return 7.0 / 64.0;
  if (idx < 23.5) return 55.0 / 64.0;
  if (idx < 24.5) return 40.0 / 64.0;
  if (idx < 25.5) return 24.0 / 64.0;
  if (idx < 26.5) return 36.0 / 64.0;
  if (idx < 27.5) return 20.0 / 64.0;
  if (idx < 28.5) return 43.0 / 64.0;
  if (idx < 29.5) return 27.0 / 64.0;
  if (idx < 30.5) return 39.0 / 64.0;
  if (idx < 31.5) return 23.0 / 64.0;
  if (idx < 32.5) return 2.0 / 64.0;
  if (idx < 33.5) return 50.0 / 64.0;
  if (idx < 34.5) return 14.0 / 64.0;
  if (idx < 35.5) return 62.0 / 64.0;
  if (idx < 36.5) return 1.0 / 64.0;
  if (idx < 37.5) return 49.0 / 64.0;
  if (idx < 38.5) return 13.0 / 64.0;
  if (idx < 39.5) return 61.0 / 64.0;
  if (idx < 40.5) return 34.0 / 64.0;
  if (idx < 41.5) return 18.0 / 64.0;
  if (idx < 42.5) return 46.0 / 64.0;
  if (idx < 43.5) return 30.0 / 64.0;
  if (idx < 44.5) return 33.0 / 64.0;
  if (idx < 45.5) return 17.0 / 64.0;
  if (idx < 46.5) return 45.0 / 64.0;
  if (idx < 47.5) return 29.0 / 64.0;
  if (idx < 48.5) return 10.0 / 64.0;
  if (idx < 49.5) return 58.0 / 64.0;
  if (idx < 50.5) return 6.0 / 64.0;
  if (idx < 51.5) return 54.0 / 64.0;
  if (idx < 52.5) return 9.0 / 64.0;
  if (idx < 53.5) return 57.0 / 64.0;
  if (idx < 54.5) return 5.0 / 64.0;
  if (idx < 55.5) return 53.0 / 64.0;
  if (idx < 56.5) return 42.0 / 64.0;
  if (idx < 57.5) return 26.0 / 64.0;
  if (idx < 58.5) return 38.0 / 64.0;
  if (idx < 59.5) return 22.0 / 64.0;
  if (idx < 60.5) return 41.0 / 64.0;
  if (idx < 61.5) return 25.0 / 64.0;
  if (idx < 62.5) return 37.0 / 64.0;
  return 21.0 / 64.0;
}

vec3 dither(vec2 fragCoord, vec3 color) {
  vec2 scaledCoord = floor(fragCoord / pixelSize);
  float x = mod(scaledCoord.x, 8.0);
  float y = mod(scaledCoord.y, 8.0);
  float threshold = bayerValue(y * 8.0 + x) - 0.25;
  float step = 1.0 / (colorNum - 1.0);
  color += threshold * step;
  color = clamp(color - 0.2, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void main() {
  vec2 pixelatedFrag = pixelSize * floor(gl_FragCoord.xy / pixelSize);
  vec2 uv = pixelatedFrag / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;

  float f = pattern(uv);
  vec3 col = mix(vec3(0.0), waveColor, f);
  col = dither(gl_FragCoord.xy, col);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('No se pudo crear el shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Error compilando shader: ${info}`);
  }
  return shader;
}

interface DitherStaticProps {
  waveFrequency?: number;
  waveAmplitude?: number;
  waveColor?: [number, number, number];
  colorNum?: number;
  pixelSize?: number;
  seed?: number;
  maxDpr?: number;
}

export default function Dither({
  waveFrequency = 3,
  waveAmplitude = 0.3,
  waveColor = [0.5, 0.5, 0.5],
  colorNum = 4,
  pixelSize = 2,
  seed = 0,
  maxDpr = 1.5
}: DitherStaticProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false })
      || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) {
      console.error('WebGL no disponible en este navegador');
      return;
    }

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Error enlazando programa WebGL:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'resolution');
    const uWaveFrequency = gl.getUniformLocation(program, 'waveFrequency');
    const uWaveAmplitude = gl.getUniformLocation(program, 'waveAmplitude');
    const uWaveColor = gl.getUniformLocation(program, 'waveColor');
    const uColorNum = gl.getUniformLocation(program, 'colorNum');
    const uPixelSize = gl.getUniformLocation(program, 'pixelSize');
    const uSeed = gl.getUniformLocation(program, 'seed');

    function render() {
      const c = canvasRef.current;
      if (!c || !gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const width = Math.floor(c.clientWidth * dpr);
      const height = Math.floor(c.clientHeight * dpr);
      if (c.width !== width || c.height !== height) {
        c.width = width;
        c.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uResolution, width, height);
      gl.uniform1f(uWaveFrequency, waveFrequency);
      gl.uniform1f(uWaveAmplitude, waveAmplitude);
      gl.uniform3f(uWaveColor, waveColor[0], waveColor[1], waveColor[2]);
      gl.uniform1f(uColorNum, colorNum);
      gl.uniform1f(uPixelSize, pixelSize);
      gl.uniform1f(uSeed, seed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    render();

    let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(render, 100);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, [waveFrequency, waveAmplitude, waveColor, colorNum, pixelSize, seed, maxDpr]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}

/* Ejemplo de uso:

import DitherStatic from "@/components/DitherStatic";

<div style={{ width: '100%', height: '600px', position: 'relative' }}>
  <DitherStatic
    waveColor={[0.5, 0.5, 0.5]}
    colorNum={4}
    waveAmplitude={0.3}
    waveFrequency={3}
    pixelSize={2}
  />
</div>

*/