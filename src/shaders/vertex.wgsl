struct Traversal {
	depth: f32,
	boundBox: vec4<f32>,
	coord: vec4<f32>,
	address: f32,
};

fn getTraversal(address: u32) -> Traversal {
	var trav: Traversal;
	let index = address*10;
	trav.depth = traversal[index]; 
	trav.boundBox = vec4<f32>(traversal[index + 1], traversal[index + 2], traversal[index + 3], traversal[index + 4]);
	trav.coord = vec4<f32>(traversal[index + 5], traversal[index + 6], traversal[index + 7], traversal[index + 8]);
	trav.address = traversal[index + 9];
	return trav;
};

@group(2) @binding(0) var<storage, read> levelValues: array<f32>;
@group(2) @binding(1) var<storage, read> traversal: array<f32>;

const VERTICE: u32 = 6;
@vertex
fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4f {
	let trav = getTraversal(0);
	let boundBox = trav.boundBox;
	let depth: u32 = u32(f32(VertexIndex) / f32(VERTICE));
	let coord: vec2<f32> = 2*trav.coord.xy;
	
	let grid: u32 = u32(pow(2.0, f32(depth)));
	let res: vec2<u32> = vec2(grid,grid);
	let pixCoord = vec2<u32>(coord.xy * vec2<f32>(res.xy));
	var quadCoord = vec2<f32>(f32(pixCoord.x) / f32(grid), f32(pixCoord.y) / f32(grid));
		
	let quad_index = VertexIndex / VERTICE;
	let vert_index = VertexIndex % VERTICE;

	let q_x = quad_index % grid;
	let q_y = quad_index / grid;

	let cell_w = 1.0 / f32(grid);
	let cell_h = 1.0 / f32(grid);

	//let x = f32(quadCoord.x) - cell_w;
	//let y = f32(quadCoord.y) - cell_h;
	let x = 0.2;
	let y = 0.5;

	let pos = array<vec2<f32>, 6>(
			vec2f(x, y),
			vec2f(x + cell_w, y),
			vec2f(x + cell_w, y + cell_h),
			vec2f(x, y + cell_h),
			vec2f(x, y),
			vec2f(x + cell_w, y + cell_h)
			);

	let local_pos = pos[vert_index];
	// if local_pos.xy is inside the boundBox, return the levelValues[depth]
	//return vec4f(local_pos, f32(depth)/12.0, 1.0); 
	
	let normDepth: f32 = f32(depth) / 12.0;
	return vec4f(local_pos, normDepth, 1.0);
}
