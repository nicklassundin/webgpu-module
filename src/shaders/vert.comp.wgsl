
struct Traversal {
	depth: f32,
	address: f32,
	coord: vec2<f32>,
	boundBox: vec4<f32>,
	quad: i32,
	_pad: vec3<i32>,
};

struct Vertex {
	position: vec4<f32>,
	values: vec4<f32>,
};
struct Quad {
	vertices: array<Vertex, 4>,
};

struct Indices {
	indices: array<u32, 6>,
};

struct State {
	iter: array<u32, 16>,
};


struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
offset: u32,
};

@group(0) @binding(0) var<storage, read_write> state: State;
// storage texture
@group(0) @binding(1) var outTexture: texture_storage_2d<rgba8unorm, write>;

@group(1) @binding(0) var<storage, read> levelValues: array<f32>;
@group(1) @binding(1) var<storage, read> traversal: array<Traversal>; 
@group(1) @binding(2) var<uniform> uniforms: Uniforms; 

// texture
@group(1) @binding(3) var texture: texture_2d<f32>;

fn getNodeIndex(level: f32, pos: f32) -> u32 {
	return u32((pow(4, level)) / 3 + pos);
}
fn modf(a: f32, b: f32) -> f32 {
    return a - b * floor(a / b);
}


@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	let textureDimensions = textureDimensions(texture);
	let y = global_id.y;
	let x = global_id.x;
	if (textureDimensions.x < x || textureDimensions.y < y) {
		return;
	}
	// color even and odd
	textureStore(outTexture, vec2<i32>(i32(x), i32(y)), vec4<f32>(0.0, 0.4, 0.6, 1.0));	
}
