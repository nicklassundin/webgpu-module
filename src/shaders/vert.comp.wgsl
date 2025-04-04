
struct Traversal {
	depth: f32,
	_pad: vec3<f32>,
	boundBox: vec4<f32>,
	coord: vec4<f32>,
	address: f32,
	_pad2: vec3<f32>,
	_pad4: vec4<f32>,
	_pad5: vec4<f32>,
};


struct Vertex {
	position: vec4<f32>,
	values: vec4<f32>,
};
@group(0) @binding(0) var<storage, read_write> vertices: array<Vertex>;

@group(1) @binding(0) var<storage, read> levelValues: array<f32>;
@group(1) @binding(1) var<storage, read> traversal: array<f32>; 
struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
};
@group(1) @binding(2) var<uniform> uniforms: Uniforms; 



const SIZE = 4*2;
@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let mipLevel = uniforms.mipLevel - f32(global_id.z);
	let grid: f32 = pow(2.0, mipLevel);
	
	var coord = vec2<f32>(traversal[5], traversal[6]);
	// Normalize
	coord = (coord + 1) * 0.5;

	let pixCoord = coord*grid;
	
	let p_x = u32(pixCoord.x);
	let p_y = u32(pixCoord.y);

	var x = f32(p_x+global_id.x) / grid;
	x = x * 2.0 - 1.0;
	var y = f32(p_y+global_id.y) / grid;
	y = y * 2.0 - 1.0;

	let index = (global_id.x + global_id.y * 2) + global_id.z*4;

	vertices[index].position = vec4<f32>(x, y, f32(global_id.z) / uniforms.mipLevel, 1.0);
	vertices[index].values = vec4<f32>(levelValues[global_id.z], 0, 0, 0); 
}
