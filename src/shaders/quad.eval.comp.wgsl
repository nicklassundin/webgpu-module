
struct Uniforms {
	resolution: vec2<f32>,
	mipLevel: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms; 


struct Node {
	valueAddress: f32,
	offset: f32,
	size: f32,
	children: vec4<f32>,	
	quad: f32,
};

struct Traversal {
	depth: vec4<f32>,
	boundBox: vec4<f32>,
	coord: vec4<f32>,
	address: f32,
};
@group(1) @binding(0) var texSampler: sampler;
@group(1) @binding(1) var texture: texture_storage_2d<rgba8unorm, write>;

@group(2) @binding(0) var<storage, read_write> traversal: Traversal;
@group(2) @binding(1) var<storage, read_write> levelValues: array<f32>;


@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let depth = u32(traversal.depth.x);
	let id = global_id.x % depth;
	let uv = traversal.coord.xy;
	let textureSize: vec2<u32> = textureDimensions(texture);
	let pixelCoord = uv * vec2<f32>(textureSize);
	
	var max: f32 = levelValues[0];
	let value = levelValues[depth] / max; 
	//textureStore(texture, vec2<i32>(i32(pixelCoord.x), i32(pixelCoord.y)), vec4<f32>(value, 0.0, 0.0, 1.0)); 
	textureStore(texture, vec2<i32>(i32(pixelCoord.x), i32(pixelCoord.y)), vec4<f32>(uv, 0.0, 1.0)); 
}
