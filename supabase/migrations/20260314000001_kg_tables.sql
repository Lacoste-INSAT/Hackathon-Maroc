-- Knowledge Graph Nodes
CREATE TABLE kg_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR NOT NULL, -- e.g., 'Patient', 'Drug', 'Symptom', 'Diagnosis'
    name VARCHAR NOT NULL,  -- e.g., 'Paracetamol', 'John Doe'
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Knowledge Graph Edges
CREATE TABLE kg_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id UUID NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
    relation_type VARCHAR NOT NULL, -- e.g., 'TAKES_DRUG', 'PRESENTS_SYMPTOM', 'TREATS'
    UNIQUE(source_node_id, target_node_id, relation_type)
);

-- Indexing for fast graph traversal
CREATE INDEX idx_kg_edges_source ON kg_edges(source_node_id);
CREATE INDEX idx_kg_edges_target ON kg_edges(target_node_id);

-- RPC for Graph Traversal (Up to 2 hops)
CREATE OR REPLACE FUNCTION get_patient_graph(p_id UUID)
RETURNS TABLE (
    edge_id UUID,
    source_id UUID,
    target_id UUID,
    relation VARCHAR,
    node_id UUID,
    node_label VARCHAR,
    node_name VARCHAR,
    node_metadata JSONB,
    hop_depth INT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE graph_traversal AS (
        -- Base condition: Step 1 (find all edges extending from the patient node, OR coming to the patient node)
        SELECT 
            e.id as edge_id,
            e.source_node_id as source_id,
            e.target_node_id as target_id,
            e.relation_type as relation,
            -- Capture the connected node (if patient is source, capture target; if patient is target, capture source)
            CASE WHEN e.source_node_id = p_id THEN e.target_node_id ELSE e.source_node_id END as node_id,
            1 as hop_depth
        FROM kg_edges e
        WHERE e.source_node_id = p_id OR e.target_node_id = p_id

        UNION

        -- Recursive condition: Step 2 (find all edges connecting to the nodes found in Step 1)
        SELECT 
            e.id as edge_id,
            e.source_node_id as source_id,
            e.target_node_id as target_id,
            e.relation_type as relation,
            CASE WHEN e.source_node_id = gt.node_id THEN e.target_node_id ELSE e.source_node_id END as node_id,
            gt.hop_depth + 1 as hop_depth
        FROM kg_edges e
        JOIN graph_traversal gt ON (e.source_node_id = gt.node_id OR e.target_node_id = gt.node_id)
        WHERE gt.hop_depth < 2 
          -- prevent walking backwards down the exact same edge
          AND e.id != gt.edge_id
    )
    SELECT 
        gt.edge_id,
        gt.source_id,
        gt.target_id,
        gt.relation,
        gt.node_id,
        n.label as node_label,
        n.name as node_name,
        n.metadata as node_metadata,
        gt.hop_depth
    FROM graph_traversal gt
    JOIN kg_nodes n ON n.id = gt.node_id;
END;
$$ LANGUAGE plpgsql;