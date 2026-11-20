// Small WebGL2 toolkit: matrices, shader programs, meshes, textures.

export const M4 = {
  create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },

  perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect; out[5] = f;
    out[10] = (far + near) * nf; out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
  },

  lookAt(out, eye, c, up) {
    let zx = eye[0] - c[0], zy = eye[1] - c[1], zz = eye[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  },

  multiply(out, a, b) {
    const r = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      r[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
    }
    out.set(r);
    return out;
  },

  invert(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  },

  // T * Ry(yaw) * Rz(pitch) * Rx(roll) * S
  compose(out, x, y, z, yaw = 0, pitch = 0, roll = 0, sx = 1, sy = sx, sz = sx) {
    const cy = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    // R = Ry * Rz * Rx
    const r00 = cy * cp, r01 = -cy * sp * cr + syw * sr, r02 = cy * sp * sr + syw * cr;
    const r10 = sp, r11 = cp * cr, r12 = -cp * sr;
    const r20 = -syw * cp, r21 = syw * sp * cr + cy * sr, r22 = -syw * sp * sr + cy * cr;
    out[0] = r00 * sx; out[1] = r10 * sx; out[2] = r20 * sx; out[3] = 0;
    out[4] = r01 * sy; out[5] = r11 * sy; out[6] = r21 * sy; out[7] = 0;
    out[8] = r02 * sz; out[9] = r12 * sz; out[10] = r22 * sz; out[11] = 0;
    out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
    return out;
  },

  transformPoint(m, p) {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w, w];
  },
};

export const ATTR = { aPos: 0, aNormal: 1, aUv: 2, aColor: 3, aBody: 4, aInst: 5, aInst2: 6 };

export function createProgram(gl, vsSrc, fsSrc, name = 'program') {
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const numbered = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      console.error(name + ' shader error:\n' + log + '\n' + numbered);
      throw new Error(name + ': ' + log);
    }
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
  for (const [k, v] of Object.entries(ATTR)) gl.bindAttribLocation(p, v, k);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ' link: ' + gl.getProgramInfoLog(p));

  const setters = {};
  let unit = 0;
  gl.useProgram(p);
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const uname = info.name.replace(/\[0\]$/, '');
    const loc = gl.getUniformLocation(p, info.name);
    const t = info.type;
    let fn;
    if (t === gl.FLOAT) fn = v => gl.uniform1f(loc, v);
    else if (t === gl.FLOAT_VEC2) fn = v => gl.uniform2fv(loc, v);
    else if (t === gl.FLOAT_VEC3) fn = v => gl.uniform3fv(loc, v);
    else if (t === gl.FLOAT_VEC4) fn = v => gl.uniform4fv(loc, v);
    else if (t === gl.FLOAT_MAT4) fn = v => gl.uniformMatrix4fv(loc, false, v);
    else if (t === gl.INT || t === gl.BOOL) fn = v => gl.uniform1i(loc, v);
    else if (t === gl.SAMPLER_2D) {
      const u = unit++;
      gl.uniform1i(loc, u);
      fn = tex => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, tex); };
    } else fn = () => {};
    setters[uname] = fn;
  }
  return {
    program: p,
    use() { gl.useProgram(p); return this; },
    set(values) {
      for (const k in values) { const f = setters[k]; if (f && values[k] !== undefined) f(values[k]); }
      return this;
    },
    has(k) { return !!setters[k]; },
  };
}

// arrays: { position:Float32Array(3), normal, uv(2), color(4), body(2), index:Uint16/32Array }
export function createMesh(gl, arrays, mode) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffers = {};
  const add = (data, loc, size, name) => {
    if (!data) return;
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data instanceof Float32Array ? data : new Float32Array(data), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    buffers[name] = b;
  };
  add(arrays.position, ATTR.aPos, 3, 'position');
  add(arrays.normal, ATTR.aNormal, 3, 'normal');
  add(arrays.uv, ATTR.aUv, 2, 'uv');
  add(arrays.color, ATTR.aColor, 4, 'color');
  add(arrays.body, ATTR.aBody, 2, 'body');
  let count = arrays.position.length / 3, indexType = 0;
  if (arrays.index) {
    const idx = arrays.index;
    const big = count > 65535;
    const data = big ? (idx instanceof Uint32Array ? idx : new Uint32Array(idx)) : (idx instanceof Uint16Array ? idx : new Uint16Array(idx));
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    count = data.length;
    indexType = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    buffers.index = ib;
  }
  gl.bindVertexArray(null);
  return {
    vao, count, indexType, mode: mode ?? gl.TRIANGLES, buffers,
    draw() {
      gl.bindVertexArray(vao);
      if (indexType) gl.drawElements(this.mode, count, indexType, 0);
      else gl.drawArrays(this.mode, 0, count);
    },
    dispose() {
      for (const k in buffers) gl.deleteBuffer(buffers[k]);
      gl.deleteVertexArray(vao);
    },
  };
}

// A buffer of per-instance or per-point data that changes every frame.
export function createDynamic(gl, layout /* [{loc,size}] */, maxItems, { instanced = false, baseMesh = null } = {}) {
  const stride = layout.reduce((a, l) => a + l.size, 0);
  const data = new Float32Array(maxItems * stride);
  const vao = baseMesh ? baseMesh.vao : gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  let off = 0;
  for (const l of layout) {
    gl.enableVertexAttribArray(l.loc);
    gl.vertexAttribPointer(l.loc, l.size, gl.FLOAT, false, stride * 4, off * 4);
    if (instanced) gl.vertexAttribDivisor(l.loc, 1);
    off += l.size;
  }
  gl.bindVertexArray(null);
  return {
    data, stride, count: 0, vao,
    upload(n) {
      this.count = n;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * stride);
    },
  };
}

export function createTexture(gl, source, { repeat = false, mips = true, flipY = false } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (mips) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  return t;
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(c) {
  return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('');
}
