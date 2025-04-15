
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
@group(0) @binding(0) var<storage, read_write> vertices: array<Vertex>;
struct Indices {
	indices: array<u32, 6>,
};
@group(0) @binding(1) var<storage, read_write> indices: array<Indices>;

@group(1) @binding(0) var<storage, read> levelValues: array<f32>;
@group(1) @binding(1) var<storage, read> traversal: array<Traversal>; 
struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
};
@group(1) @binding(2) var<uniform> uniforms: Uniforms; 



const SIZE = 4*2;
@compute @workgroup_size(2,2)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	let z = global_id.z;
	let level: u32 = u32(traversal[z].depth+1);
	let grid: f32 = pow(2.0, uniforms.mipLevel - f32(level));

/*
	if(traversal[z].depth < 9.0) {
		return;
	}
	*/
	
	//var coord = traversal[0].coord;
	var coord = traversal[z].coord;

	let pixCoord = coord*grid;
	
	let p_x = u32(pixCoord.x);
	let p_y = u32(pixCoord.y);

	var x = f32(p_x+local_id.x) / grid;
	var y = f32(p_y+local_id.y) / grid;

	let index = (local_id.x + local_id.y * 2) + z*2*2;

	vertices[index].position = vec4<f32>(x, y, f32(z) / uniforms.mipLevel, 1.0);
	vertices[index].values = vec4<f32>(levelValues[level], 0, 0, 0); 
	//vertices[index].values = vec4<f32>(0.5, 0, 0, 0);

	let quad = index % 4;
	if(quad == 0){
		indices[z].indices[0] = index;
	}else if(quad == 1){
		indices[z].indices[1] = index;
		indices[z].indices[3] = index;
	}else if(quad == 2){
		indices[z].indices[2] = index;
		indices[z].indices[5] = index;
	}else if(quad == 3){
		indices[z].indices[4] = index;
	}
}
