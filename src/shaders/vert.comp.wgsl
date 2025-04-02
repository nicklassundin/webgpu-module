
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
	let gl_y = global_id.y;
	let depth = f32(gl_y) / uniforms.mipLevel;
	
	
	let numVert: u32 = 6;
	let grid: u32 = u32(pow(f32(gl_y), 2));
	let quad_index = id / numVert;
	let vert_index = id % numVert;

	let q_x = quad_index % grid;
	let q_y = quad_index / grid;

	let cell_w = 2.0 / f32(grid);
	let cell_h = 2.0 / f32(grid);

	let x = -1.0 + f32(q_x) * cell_w;
	let y = -1.0 + f32(q_y) * cell_h;
	
	let pos = array<vec2<f32>, 6>(
			vec2f(x, y),
			vec2f(x + cell_w, y),
			vec2f(x + cell_w, y + cell_h),
			vec2f(x, y + cell_h),
			vec2f(x, y),
			vec2f(x + cell_w, y + cell_h)
			);
	
	let local_pos = pos[vert_index];
	
	let index = id*4+gl_y*4*6;
	vertices[index] = local_pos.x; 
	vertices[index + 1] = local_pos.y;
	vertices[index + 2] = 0.5; 
	vertices[index + 3] = 1.0;

	let i = id*6 + gl_y*6*4;
	indices[i] = i;
	indices[i + 1] = i + 1;
	indices[i + 2] = i + 2;
	
	indices[i + 3] = i;
	indices[i + 4] = i + 2;
	indices[i + 5] = i + 3;
}
