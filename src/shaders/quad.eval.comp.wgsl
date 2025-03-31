
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

@group(0) @binding(0) var texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<storage, read_write> result: array<f32>;
@group(0) @binding(2) var<storage, read_write> traversal: array<f32>;



@group(1) @binding(0) var<storage, read> selected: array<f32>;
@group(1) @binding(1) var<storage, read> levelValues: array<f32>;


@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let index = global_id.x;

	result[index] = abs(selected[index] - levelValues[index]) ;
	//var max: f32 = levelValues[0];
	//let value = levelValues[depth];
	//traversal.coord.x = 0.0;
	//textureStore(texture, vec2<i32>(i32(pixelCoord.x), i32(pixelCoord.y)), vec4<f32>(1.0, 1.0, 0.0, 1.0)); 
}
