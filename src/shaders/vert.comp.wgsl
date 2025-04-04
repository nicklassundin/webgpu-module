
struct Traversal {
	depth: f32,
	boundBox: vec4<f32>,
	coord: vec4<f32>,
	address: f32,
};

@group(0) @binding(0) var<storage, read_write> vertices: array<f32>;
@group(0) @binding(1) var<storage, read_write> indices: array<u32>;

@group(1) @binding(0) var<storage, read> selected: array<f32>;
@group(1) @binding(1) var<storage, read> levelValues: array<f32>;
@group(1) @binding(2) var<storage, read> traversal: Traversal; 
struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
};
@group(1) @binding(3) var<uniform> uniforms: Uniforms; 


@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let mipLevel = uniforms.mipLevel - f32(global_id.z);
	let grid: f32 = pow(2.0, mipLevel);
	var x = f32(global_id.x) / grid;
	x = x * 2.0 - 1.0;
	var y = f32(global_id.y) / grid;
	y = y * 2.0 - 1.0;

	let index = (global_id.x + global_id.y * 2)*4 + global_id.z*4*4;
	
	vertices[index + 0] = x;
	vertices[index + 1] = y;
	//vertices[index + 2] = 0.0;
	//vertices[index + 2] = mipLevel;
	//vertices[index + 2] = f32(index);
	vertices[index + 3] = 1.0;
}
