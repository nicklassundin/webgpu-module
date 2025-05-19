
struct Node {
valueAddress: f32,
		      children: vec4<f32>,	
		      quad: f32,
};

struct Traversal {
depth: f32,
	       address: f32,
	       coord: vec2<f32>,
	       boundBox: vec4<f32>,
	       quad: i32,
	       done: i32,
	       _pad: vec2<f32>,
};

@group(0) @binding(0) var<storage, read_write> result: array<array<f32, 16>>;
@group(0) @binding(1) var<storage, read_write> traversal: array<Traversal>; 
@group(0) @binding(2) var<storage, read_write> quadMap: array<u32>;

@group(0) @binding(3) var texture: texture_storage_2d<rgba8unorm, write>;



@group(1) @binding(0) var<storage, read> levelValues: array<array<f32, 16>>;


struct ThreadInfo {
reference: array<f32, 16>,
		   iterations: array<u32>,
};
@group(1) @binding(1) var<storage, read_write> threadIterations: ThreadInfo; 


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
	return u32(quad);
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

fn getNodeIndex(level: f32, pos: f32) -> u32 {
	return u32((pow(4, level)) / 3 + pos);
}


@compute @workgroup_size(1)
	fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
			@builtin(local_invocation_id) local_id: vec3<u32>) {
		let texDim = textureDimensions(texture);
		let threadIndex = local_id.x;
		let iter = threadIterations.iterations[threadIndex];
		

		let index: u32 = (iter) % 16u; 
		
		let boundBox = traversal[index].boundBox;
		let center = (boundBox.xy + boundBox.zw) * 0.5;
		var quad = 0u;
		var coord = traversal[index].coord;
		
		let value = abs(threadIterations.reference[index] - levelValues[threadIndex][index-1]);
		let texCoord = vec2<u32>(vec2<f32>(texDim) * vec2<f32>(coord.x, coord.y));
		let color = vec4<f32>(value, 0.0, 0.0, 1.0);
		textureStore(texture, texCoord, color); 
	
		if (iter < 32u) {
			threadIterations.reference[index] = levelValues[threadIndex][index];
		}else{

		
		// for loop traversing quadMap
		var q0 = getNodeIndex(f32(index), 0.0);
		var q1 = getNodeIndex(f32(index), 1.0); 
		var q2 = getNodeIndex(f32(index), 2.0);
		var q3 = getNodeIndex(f32(index), 3.0);

		if (quadMap[q0] == 0u){
			quadMap[q0] = 1u; 
		} else if (quadMap[q1] == 0u){
			quad = (quad + 1u) % 4u;
			quadMap[q1] = 1u;
		} else if (quadMap[q2] == 0u){
			quad = (quad + 2u) % 4u;
			quadMap[q2] = 1u;
		} else if (quadMap[q3] == 0u){
			quad = (quad + 3u) % 4u;
			quadMap[q3] = 1u;
		}else{

		}
		let nBoundBox = boundBoxFromeCoord(quad, boundBox);
		// coord center of boundBox
		coord = vec2<f32>(nBoundBox.x + nBoundBox.z, nBoundBox.y + nBoundBox.w) * 0.5;

		traversal[index+1].coord = coord;
		traversal[index+1].boundBox = nBoundBox;
		traversal[index+1].quad = i32(quad);
		}

		result[threadIndex][index*2] = f32(texDim.x);
		result[threadIndex][index*2+1] = f32(texDim.y);
		threadIterations.iterations[threadIndex] += 1u;
		traversal[index].done = 1;
	}
