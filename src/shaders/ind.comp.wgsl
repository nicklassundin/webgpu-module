
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
	let id = global_id.x;
	let mipLevel = uniforms.mipLevel;
	let grid: u32 = u32(pow(2, mipLevel));
	
	let index = u32(id)*6;
	let i = 0u*6;
	let offset: u32 = u32(grid-id);
/*
	indices[index] = 0;
	indices[index + 1] = id+1;
	indices[index + 2] = grid;
	
	indices[index + 3] = id+1;
	indices[index + 4] = grid+1;
	indices[index + 5] = grid;
*/
	indices[index] = 0;
	indices[index + 1] = grid*(id+1);
	indices[index + 2] = grid*(id+1)+1;

	indices[index + 4] = 1;
	indices[index + 5] = grid*(id+1)+1;
	indices[index + 6] = grid;
}
