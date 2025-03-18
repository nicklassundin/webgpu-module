
struct Uniforms {
	resolution: vec2<f32>,
	mipLevel: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms; 

@group(1) @binding(0) var samplerTex: sampler;
@group(1) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;

struct Node {
	valueAddress: f32,
	offset: f32,
	size: f32,
	children: vec4<f32>,	
	quad: f32,
};

struct Traversal {
	depth: f32,
	boundBox: vec4<f32>,
	coord: vec2<f32>,
	address: f32,
};
@group(2) @binding(0) var<storage, read_write> traversal: Traversal;
@group(2) @binding(1) var<storage, read_write> values: array<f32>;
@group(2) @binding(2) var<storage, read_write> nodes: array<Node>;

@compute @workgroup_size(2,2)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let pos = vec2<u32>(global_id.xy);
	let id = f32(pos.x + pos.y) * 2.0;

     	textureStore(outputTexture, pos, vec4<f32>(1.0, 0.0, 0.0, 1.0)); // Red
}
