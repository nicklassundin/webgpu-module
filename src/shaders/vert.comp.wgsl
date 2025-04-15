
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

struct State {
	iter: array<u32, 16>,
};
@group(0) @binding(2) var<storage, read_write> state: State;


@group(1) @binding(0) var<storage, read> levelValues: array<f32>;
@group(1) @binding(1) var<storage, read> traversal: array<Traversal>; 
struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
offset: u32,
};
@group(1) @binding(2) var<uniform> uniforms: Uniforms; 



@compute @workgroup_size(2,2,2)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	//let z = global_id.z;
	let z = local_id.z;
	//let index = z + global_id.z*4;
	let index = z + state.iter[z]/2;
	//let index = z;
	let level: u32 = u32(traversal[index].depth);
	let grid: f32 = pow(2.0, uniforms.mipLevel - f32(level+1));

	
	//var coord = traversal[0].coord;
	var coord = traversal[index].coord;

	let pixCoord = coord*grid;
	
	let p_x = u32(pixCoord.x);
	let p_y = u32(pixCoord.y);

	var x = f32(p_x+local_id.x) / grid;
	var y = f32(p_y+local_id.y) / grid;

	//let vIndex = (local_id.x + local_id.y * 2) + index*2*2;
	let vIndex = (local_id.x + local_id.y * 2) + index*2*2;

	vertices[vIndex].position = vec4<f32>(x, y, f32(index) / uniforms.mipLevel, 1.0);
	vertices[vIndex].values = vec4<f32>(levelValues[level], 0, 0, 0); 

	let quad = vIndex % 4;
	if(quad == 0){
		indices[index].indices[0] = vIndex;
	}else if(quad == 1){
		indices[index].indices[1] = vIndex;
		indices[index].indices[3] = vIndex;
	}else if(quad == 2){
		indices[index].indices[2] = vIndex;
		indices[index].indices[5] = vIndex;
	}else if(quad == 3){
		indices[index].indices[4] = vIndex;
	}
	state.iter[z] += 4;
}
