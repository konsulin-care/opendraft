# protocol/ — Conventions

## Turtle Syntax

```turtle
# Prefixes at top of file
@prefix od: <https://opendraft.org/ontology#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Use blank nodes for complex structures
od:Article
    a rdfs:Class ;
    rdfs:label "Article" ;
    rdfs:comment "A published article" .
```

## SHACL Shapes

```turtle
# Node shapes for validation
od:ArticleShape
    a sh:NodeShape ;
    sh:targetClass od:Article ;
    sh:property [
        sh:path od:title ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] .
```

## Naming Conventions

- Classes: PascalCase in URI (od:Article)
- Properties: camelCase in URI (od:hasAuthor)
- Shapes: PascalCase + Shape suffix (od:ArticleShape)
- Files: lowercase with dots (article.shacl.ttl)

## Validation

- All TTL must parse with `rapper` or equivalent.
- All shapes must validate with `pyshacl` or equivalent.
- Run conformance tests before committing protocol changes.
