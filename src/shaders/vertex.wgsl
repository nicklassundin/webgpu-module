

@group(2) @binding(0) var<storage, read> levelValues: array<f32>;

const GRID: u32 = 10; 
@vertex
fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4f {
	let grid: u32 = GRID;
	let vertice: u32 = 6;
	let quad_index = VertexIndex / vertice;
	let vert_index = VertexIndex % vertice;

	let q_x = quad_index % grid;
	let q_y = quad_index / grid;

	let cell_w = 2.0 / f32(grid);
	let cell_h = 2.0 / f32(grid);

	let x = f32(q_x) * cell_w - 1.0;
	let y = f32(q_y) * cell_h - 1.0;

	let pos = array<vec2<f32>, 6>(
			vec2f(x, y),
			vec2f(x + cell_w, y),
			vec2f(x + cell_w, y + cell_h),
			vec2f(x, y + cell_h),
			vec2f(x, y),
			vec2f(x + cell_w, y + cell_h)
			);

	let local_pos = pos[vert_index];
	
	var test: f32 = 0.0;
	return vec4f(local_pos, levelValues[3], 1.0); 
}
