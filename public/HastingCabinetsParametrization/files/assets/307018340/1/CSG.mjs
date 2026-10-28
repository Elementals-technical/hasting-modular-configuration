import { Vec3 } from 'playcanvas';

// ==============================================================================
// CSG LIBRARY (Constructive Solid Geometry)
// Based on csg.js (MIT License)
// ==============================================================================

class CSG {
    constructor() {
        this.polygons = [];
    }
    static fromPolygons(polygons) {
        const csg = new CSG();
        csg.polygons = polygons;
        return csg;
    }
    clone() {
        const csg = new CSG();
        csg.polygons = this.polygons.map(p => p.clone());
        return csg;
    }
    toPolygons() {
        return this.polygons;
    }
    union(csg) {
        const a = new Node(this.clone().polygons);
        const b = new Node(csg.clone().polygons);
        a.clipTo(b);
        b.clipTo(a);
        b.invert();
        b.clipTo(a);
        b.invert();
        a.build(b.allPolygons());
        return CSG.fromPolygons(a.allPolygons());
    }
    subtract(csg) {
        const a = new Node(this.clone().polygons);
        const b = new Node(csg.clone().polygons);
        a.invert();
        a.clipTo(b);
        b.clipTo(a);
        b.invert();
        b.clipTo(a);
        b.invert();
        a.build(b.allPolygons());
        a.invert();
        return CSG.fromPolygons(a.allPolygons());
    }
    intersect(csg) {
        const a = new Node(this.clone().polygons);
        const b = new Node(csg.clone().polygons);
        a.invert();
        b.clipTo(a);
        b.invert();
        a.clipTo(b);
        b.clipTo(a);
        a.build(b.allPolygons());
        a.invert();
        return CSG.fromPolygons(a.allPolygons());
    }
}

export class Vector {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    clone() { return new Vector(this.x, this.y, this.z); }
    negated() { return new Vector(-this.x, -this.y, -this.z); }
    plus(a) { return new Vector(this.x + a.x, this.y + a.y, this.z + a.z); }
    minus(a) { return new Vector(this.x - a.x, this.y - a.y, this.z - a.z); }
    times(a) { return new Vector(this.x * a, this.y * a, this.z * a); }
    dividedBy(a) { return new Vector(this.x / a, this.y / a, this.z / a); }
    dot(a) { return this.x * a.x + this.y * a.y + this.z * a.z; }
    lerp(a, t) { return this.plus(a.minus(this).times(t)); }
    length() { return Math.sqrt(this.dot(this)); }
    unit() { return this.dividedBy(this.length()); }
    cross(a) { return new Vector(this.y * a.z - this.z * a.y, this.z * a.x - this.x * a.z, this.x * a.y - this.y * a.x); }
}

export class Vertex {
    constructor(pos, normal, uv) {
        this.pos = new Vector(pos.x, pos.y, pos.z);
        this.normal = new Vector(normal.x, normal.y, normal.z);
        this.uv = new Vector(uv.x, uv.y, 0);
    }
    clone() { return new Vertex(this.pos, this.normal, this.uv); }
    flip() { this.normal = this.normal.negated(); }
    interpolate(other, t) {
        return new Vertex(
            this.pos.lerp(other.pos, t),
            this.normal.lerp(other.normal, t),
            this.uv.lerp(other.uv, t)
        );
    }
}

class Plane {
    constructor(normal, w) { this.normal = normal; this.w = w; }
    clone() { return new Plane(this.normal.clone(), this.w); }
    flip() { this.normal = this.normal.negated(); this.w = -this.w; }
    static fromPoints(a, b, c) {
        const n = b.minus(a).cross(c.minus(a)).unit();
        return new Plane(n, n.dot(a));
    }
    splitPolygon(polygon, coplanarFront, coplanarBack, front, back) {
        const COPLANAR = 0, FRONT = 1, BACK = 2, SPANNING = 3;
        const EPSILON = 1e-5;
        let polygonType = 0;
        const types = [];
        for (let i = 0; i < polygon.vertices.length; i++) {
            const t = this.normal.dot(polygon.vertices[i].pos) - this.w;
            const type = (t < -EPSILON) ? BACK : (t > EPSILON) ? FRONT : COPLANAR;
            polygonType |= type;
            types.push(type);
        }
        switch (polygonType) {
            case COPLANAR: (this.normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon); break;
            case FRONT: front.push(polygon); break;
            case BACK: back.push(polygon); break;
            case SPANNING:
                const f = [], b = [];
                for (let i = 0; i < polygon.vertices.length; i++) {
                    const j = (i + 1) % polygon.vertices.length;
                    const ti = types[i], tj = types[j];
                    const vi = polygon.vertices[i], vj = polygon.vertices[j];
                    if (ti != BACK) f.push(vi);
                    if (ti != FRONT) b.push(vi ? vi.clone() : null);
                    if ((ti | tj) == SPANNING) {
                        const t = (this.w - this.normal.dot(vi.pos)) / this.normal.dot(vj.pos.minus(vi.pos));
                        const v = vi.interpolate(vj, t);
                        f.push(v);
                        b.push(v.clone());
                    }
                }
                if (f.length >= 3) front.push(new Polygon(f, polygon.shared));
                if (b.length >= 3) back.push(new Polygon(b, polygon.shared));
                break;
        }
    }
}

export class Polygon {
    constructor(vertices, shared) {
        this.vertices = vertices;
        this.shared = shared;
        this.plane = Plane.fromPoints(vertices[0].pos, vertices[1].pos, vertices[2].pos);
    }
    clone() { return new Polygon(this.vertices.map(v => v.clone()), this.shared); }
    flip() { this.vertices.reverse().forEach(v => v.flip()); this.plane.flip(); }
}

class Node {
    constructor(polygons) {
        this.plane = null;
        this.front = null;
        this.back = null;
        this.polygons = [];
        if (polygons) this.build(polygons);
    }
    clone() {
        const node = new Node();
        node.plane = this.plane && this.plane.clone();
        node.front = this.front && this.front.clone();
        node.back = this.back && this.back.clone();
        node.polygons = this.polygons.map(p => p.clone());
        return node;
    }
    invert() {
        for (let i = 0; i < this.polygons.length; i++) this.polygons[i].flip();
        this.plane && this.plane.flip();
        this.front && this.front.invert();
        this.back && this.back.invert();
        const temp = this.front;
        this.front = this.back;
        this.back = temp;
    }
    clipPolygons(polygons) {
        if (!this.plane) return polygons.slice();
        let front = [], back = [];
        for (let i = 0; i < polygons.length; i++) {
            this.plane.splitPolygon(polygons[i], front, back, front, back);
        }
        if (this.front) front = this.front.clipPolygons(front);
        if (this.back) back = this.back.clipPolygons(back);
        else back = [];
        return front.concat(back);
    }
    clipTo(bsp) {
        this.polygons = bsp.clipPolygons(this.polygons);
        if (this.front) this.front.clipTo(bsp);
        if (this.back) this.back.clipTo(bsp);
    }
    allPolygons() {
        let polygons = this.polygons.slice();
        if (this.front) polygons = polygons.concat(this.front.allPolygons());
        if (this.back) polygons = polygons.concat(this.back.allPolygons());
        return polygons;
    }
    build(polygons) {
        if (!polygons.length) return;
        if (!this.plane) this.plane = polygons[0].plane.clone();
        const front = [], back = [];
        for (let i = 0; i < polygons.length; i++) {
            this.plane.splitPolygon(polygons[i], this.polygons, this.polygons, front, back);
        }
        if (front.length) {
            if (!this.front) this.front = new Node();
            this.front.build(front);
        }
        if (back.length) {
            if (!this.back) this.back = new Node();
            this.back.build(back);
        }
    }
}

export { CSG };