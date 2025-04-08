
struct Node {
	valueAddress: f32,
	offset: f32,
	size: f32,
	children: vec4<f32>,	
	quad: f32,
};

struct Traversal {
	depth: f32,
	address: f32,
	coord: vec2<f32>,
	boundBox: vec4<f32>,
	quad: i32,
	_pad: vec3<i32>,
};

@group(0) @binding(0) var<storage, read_write> result: array<f32>;
@group(0) @binding(1) var<storage, read_write> traversal: array<Traversal>; 

@group(1) @binding(0) var<storage, read> selected: array<f32>;
@group(1) @binding(1) var<storage, read> levelValues: array<f32>;


fn quadFromeCoord(uv: vec2<f32>, boundBox: vec4<f32>) -> u32 {
	var coord = uv;
	// normalize in boundBox
	coord.x = (coord.x - boundBox.x) / (boundBox.z - boundBox.x);
	coord.y = (coord.y - boundBox.y) / (boundBox.w - boundBox.y);
	// convert to 0 or 1
	coord.x = step(0.5, coord.x);
	coord.y = step(0.5, coord.y);
	// quad
	let quad = u32(coord.x + coord.y * 2.0);
	return quad;
}

fn boundBoxFromeCoord(quad: u32, boundBox: vec4<f32>) -> vec4<f32> {
	// new boundbox
	var nBoundBox = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	let center = (boundBox.xy + boundBox.zw) * 0.5;
	if (quad == 0u){
		nBoundBox = vec4<f32>(boundBox.x, boundBox.y, center.x, center.y);
	} else if (quad == 1u){
		nBoundBox = vec4<f32>(center.x, boundBox.y, boundBox.z, center.y);
	} else if (quad == 2u){
		nBoundBox = vec4<f32>(boundBox.x, center.y, center.x, boundBox.w);
	} else if (quad == 3u){
		nBoundBox = vec4<f32>(center.x, center.y, boundBox.z, boundBox.w);
	}
	return nBoundBox;
}

@compute @workgroup_size(4,4)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
@builtin(local_invocation_id) local_id: vec3<u32>) {
	let index = local_id.x + local_id.y * 4;
	
	let boundBox = traversal[index].boundBox;
	var coord = traversal[index].coord;

	if ((coord.x+coord.y == 0.0) & (boundBox.x + boundBox.y + boundBox.z + boundBox.w == 0.0)){
		// if both are zero, we are done
		return;
	}
	let quad = quadFromeCoord(coord, boundBox);
	let nBoundBox = boundBoxFromeCoord(quad, boundBox);

	traversal[index+1].depth = f32(index+1);
	traversal[index+1].address = traversal[index].address;
	traversal[index+1].coord = traversal[index].coord;
	traversal[index+1].boundBox = nBoundBox;
	traversal[index+1].quad = i32(quad);


		
	result[index] = abs(selected[index] - levelValues[index]);
	//result[index] = index;
}
